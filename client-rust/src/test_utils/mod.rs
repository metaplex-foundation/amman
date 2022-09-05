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

pub struct AmmanProcess {
    process: Option<Child>,
}

impl AmmanProcess {
    pub fn new() -> Self {
        Self { process: None }
    }

    pub fn ensure_started(&mut self) -> AmmanProcessResult<()> {
        if self.process.is_none() {
            return self.start();
        }
        Ok(())
    }

    pub fn start(&mut self) -> AmmanProcessResult<()> {
        if self.process.is_some() {
            return Err(AmmanProcessError::AmmanWasAlreadyStarted);
        }
        if let Some(pid) = pid_of_amman_running_on_machine() {
            return Err(AmmanProcessError::AmmanAlreadyRunning(pid));
        }
        let process = Command::new("amman_").arg("start").spawn()?;
        while pid_of_amman_running_on_machine().is_none() {}
        self.process = Some(process);
        Ok(())
    }

    pub fn kill(&mut self) -> AmmanProcessResult<()> {
        if self.process.is_none() {
            return Err(AmmanProcessError::AmmanCannotBeKilledIfNotRunning);
        }
        let process: &mut Child = self.process.as_mut().unwrap();
        process.kill()?;
        self.process = None;
        Ok(())
    }

    pub fn started(&self) -> bool {
        self.process.is_some()
    }
}

fn pid_of_amman_running_on_machine() -> Option<u32> {
    let client = AmmanClient::new(None);
    match client.request_validator_pid() {
        Ok(pid) => Some(pid),
        Err(_) => None,
    }
}
