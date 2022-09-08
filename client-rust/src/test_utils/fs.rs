use std::io::Write;
use std::path::PathBuf;
use tempfile::{Builder, NamedTempFile};

use crate::amman_config::AmmanConfig;

pub fn write_amman_config(config: &AmmanConfig) -> (PathBuf, NamedTempFile) {
    // tmp file needs to have `.json` extension so that amman requires it properly
    let mut file = Builder::new()
        .prefix("amman-config_")
        .suffix(".json")
        .tempfile()
        .expect("Failed to create tempfile");
    file.write_all(config.json_pretty().as_bytes()).unwrap();
    (file.path().to_path_buf(), file)
}
