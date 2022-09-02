use std::process::{Child, Command};

use crate::blocking::AmmanClient;

pub struct AmmanProcess {
    process: Option<Child>,
}

impl AmmanProcess {
    pub fn new() {
        Self { process: None }
    }

    pub fn start(&mut self) -> Result<()> {
        if self.process.is_some() {
            Err("Amman already running")
        }
        let process = Command::new("amman_").arg("start").spawn()?;
        self.process = Some(process);
        Ok(())
    }

    pub fn kill(&mut self) -> Result<()> {
        if self.process.is_none() {
            Err("Amman not running")
        }
        amman.kill().expect("failed to kill amman")?;
        self.process = None;
        Ok(())
    }

    fn has_amman_running_on_machine(client: &AmmanClient) -> Option<u32> {
        match client.request_validator_pid() {
            Ok(pid) => Some(pid),
            Err(_) => None,
        }
    }
}
