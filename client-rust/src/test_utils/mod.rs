use std::{
    io,
    net::TcpStream,
    process::{Child, Command, Stdio},
    str,
};
use thiserror::Error;

use crate::blocking::AmmanClient;

pub type AmmanProcessResult<T> = Result<T, AmmanProcessError>;

// TODO(thlorenz): may have to get this from env in the future
const AMMAN_EXECUTABLE: &str = "amman_";

#[derive(Error, Debug)]
pub enum AmmanProcessError {
    #[error("amman was already started")]
    AmmanWasAlreadyStarted,

    #[error("amman already running on this machine with pid {0}, please kill it first and then continue")]
    AmmanAlreadyRunning(u32),

    #[error("amman is not running and thus cannot be killed")]
    AmmanCannotBeKilledIfNotRunning,

    #[error("failed to kill amman")]
    FailedToKillAmman(#[from] io::Error),
}

pub struct AmmanProcess {
    process: Option<Child>,
    pid: Option<u32>,
    client: AmmanClient,
}

impl Clone for AmmanProcess {
    fn clone(&self) -> Self {
        // Cannot clone the process, thus this mainly serves to not have to query the pid
        // for an externally running amman again.
        // It is mainly used when attempting to restart the validator.
        Self {
            process: None,
            pid: self.pid.clone(),
            client: self.client.clone(),
        }
    }
}

impl AmmanProcess {
    pub fn new(client: AmmanClient) -> Self {
        Self {
            process: None,
            pid: None,
            client,
        }
    }

    pub fn ensure_started(&mut self) -> AmmanProcessResult<()> {
        if self.process.is_some() {
            return Ok(());
        }
        if let Some(pid) = self.client.request_validator_pid().ok() {
            self.pid = Some(pid);
            return Ok(());
        }
        self.start()
    }

    pub fn start(&mut self) -> AmmanProcessResult<()> {
        if self.process.is_some() {
            return Err(AmmanProcessError::AmmanWasAlreadyStarted);
        }
        if let Some(pid) = pid_of_amman_running_on_machine(&self.client) {
            return Err(AmmanProcessError::AmmanAlreadyRunning(pid));
        }

        let mut cmd = Command::new(AMMAN_EXECUTABLE);
        cmd.arg("start").stdout(Stdio::null()).stderr(Stdio::null());
        let process = cmd.spawn()?;

        eprint!("\nWaiting for pid");
        loop {
            match pid_of_amman_running_on_machine(&self.client) {
                Some(pid) => {
                    eprintln!(": {:#?}", pid);
                    break;
                }
                None => {}
            }
        }

        eprint!("Waiting for validator to be ready: ");
        wait_for_port(8900);
        eprint!("✔️\n");
        self.process = Some(process);
        Ok(())
    }

    pub fn restart(&mut self) -> AmmanProcessResult<()> {
        self.kill(true)?;
        self.start()?;
        Ok(())
    }

    pub fn kill(&mut self, kill_external: bool) -> AmmanProcessResult<()> {
        if self.process.is_none() && self.pid.is_none() {
            return Err(AmmanProcessError::AmmanCannotBeKilledIfNotRunning);
        }

        self.client
            .request_kill_amman()
            .expect("should kill amman properly");

        if let Some(process) = self.process.as_mut() {
            process.kill()?;
            process.wait()?;
            self.process = None;
        } else if let Some(pid) = self.pid {
            if kill_external {
                let mut process = Command::new(AMMAN_EXECUTABLE).arg("stop").spawn()?;
                process.wait()?;
                self.pid = None;
            } else {
                eprintln!("Refusing to kill process that was not created by this runner ({:#?}). Please kill via `amman stop`",  pid);
            }
        }

        Ok(())
    }

    pub fn started(&self) -> bool {
        self.process.is_some() || self.pid.is_some()
    }
}

pub fn shutdown_amman() {
    let client = AmmanClient::new(None);

    if pid_of_amman_running_on_machine(&client).is_some() {
        client
            .request_kill_amman()
            .expect("failed to kill running amman");
        while pid_of_amman_running_on_machine(&client).is_some() {}
    }
}

pub fn pid_of_amman_running_on_machine(client: &AmmanClient) -> Option<u32> {
    match client.request_validator_pid() {
        Ok(pid) => Some(pid),
        Err(_) => None,
    }
}

fn scan_port(port: u16) -> bool {
    match TcpStream::connect(("0.0.0.0", port)) {
        Ok(_) => true,
        Err(_) => false,
    }
}

fn wait_for_port(port: u16) {
    while !scan_port(port) {}
}
