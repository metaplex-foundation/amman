use lazy_static::lazy_static;
use std::{
    io,
    process::{Child, Command},
};
use thiserror::Error;

use crate::blocking::AmmanClient;

pub type AmmanProcessResult<T> = Result<T, AmmanProcessError>;

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

lazy_static! {
    pub static ref AMMAN: AmmanProcess = {
        let client = AmmanClient::new(None);
        let mut amman = AmmanProcess::new(client);
        amman.ensure_started().unwrap();
        amman
    };
}

pub struct AmmanProcess {
    process: Option<Child>,
    pid: Option<u32>,
    client: AmmanClient,
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
        let process = Command::new("amman_").arg("start").spawn()?;
        while pid_of_amman_running_on_machine(&self.client).is_none() {}
        self.process = Some(process);
        Ok(())
    }

    pub fn kill(&mut self) -> AmmanProcessResult<()> {
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
            eprintln!("Refusing to kill process that was not created by this runner ({:#?}). Please kill via `amman stop`",  pid);
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

/*
#[cfg(test)]
#[ctor::ctor]
fn init() {
    env_logger::init();
}
*/
