// TODO(thlorenz): complete these configs as needed
use serde::{Deserialize, Serialize};

/*
type ValidatorConfig = {
  killRunningValidators: boolean
  programs: Program[]
  accountsCluster: string
  accounts: Account[]
  jsonRpcUrl: string
  websocketUrl: string
  commitment: Commitment
  ledgerDir: string
  resetLedger: boolean
  limitLedgerSize: number
  verifyFees: boolean
  detached: boolean
  matchFeatures?: Cluster
  deactivateFeatures?: string[]
}
*/
#[derive(Default, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ValidatorConfig {
    #[serde(rename = "killRunningValidators")]
    kill_running_validators: bool,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    programs: Option<Vec<Program>>,
    #[serde(rename = "accountsCluster")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    accounts_cluster: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    accounts: Option<Vec<Account>>,
    #[serde(rename = "jsonRpcUrl")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    json_rpc_url: Option<String>,
    #[serde(rename = "websocketUrl")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    websocket_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    commitment: Option<String>,
    #[serde(rename = "ledgerDir")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    ledger_dir: Option<String>,
    #[serde(rename = "resetLedger")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    reset_ledger: Option<bool>,
    #[serde(rename = "limitLedgerSize")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    limit_ledger_size: Option<u64>,
    #[serde(rename = "verifyFees")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    verify_fees: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    detached: Option<bool>,
    #[serde(rename = "matchFeatures")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    match_features: Option<String>,
    #[serde(rename = "deactivateFeatures")]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    deactivate_features: Option<Vec<String>>,
}

/*
type Account = {
  label?: string
  accountId: string
  cluster?: string
  executable?: boolean
}
*/
#[derive(Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Account {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    label: Option<String>,

    #[serde(rename = "accountId")]
    account_id: String,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    cluster: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    executable: Option<bool>,
}
/*
type Program = {
  label?: string
  programId: string
  deployPath: string
}
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Program;

/*
* type RelayConfig = {
  enabled: boolean
  killRunningRelay: boolean
  accountProviders: Record<string, AmmanAccountProvider>
  accountRenderers: AmmanAccountRendererMap
}
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RelayConfig;

/*
type StorageConfig = {
  enabled: boolean
  storageId: string
  clearOnStart: boolean
}
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageConfig;

/*
type SnapshotConfig = {
  snapshotFolder: string
  load?: string
}
*/
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotConfig;

/*
type AmmanConfig = {
  validator?: ValidatorConfig
  relay?: RelayConfig
  storage?: StorageConfig
  snapshot?: SnapshotConfig
  streamTransactionLogs?: boolean
  assetsFolder?: string
}
*/
#[derive(Default, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AmmanConfig {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub validator: Option<ValidatorConfig>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub relay: Option<RelayConfig>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub storage: Option<StorageConfig>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub snapshot: Option<SnapshotConfig>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub stream_transaction_logs: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub assets_folder: Option<bool>,
}

impl AmmanConfig {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn set_validator(mut self, conf: ValidatorConfig) -> Self {
        self.validator = Some(conf);
        self
    }

    pub fn json(&self) -> String {
        serde_json::to_string_pretty(self)
            .expect(&format!("Failed to convert to JSON. {:#?}", self))
    }

    pub fn from_json(json: &str) -> Self {
        serde_json::from_str::<Self>(json).expect(&format!("Failed to deserialize {}", json))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn roundtrip(config: &AmmanConfig) {
        let json = config.json();
        let deserialized = AmmanConfig::from_json(&json);

        if std::env::var("DUMP_CONFIG").is_ok() {
            eprintln!("Config: {:#?}", config);
        }
        if std::env::var("DUMP_JSON").is_ok() {
            eprintln!("JSON: {}", json);
        }
        if std::env::var("DUMP_DESERIALIZED").is_ok() {
            eprintln!("Deserialized: {:#?}", deserialized);
        }
        assert_eq!(&deserialized, config);
    }

    #[test]
    fn empty() {
        let config = AmmanConfig::new();
        roundtrip(&config);
    }

    #[test]
    fn validator() {
        roundtrip(&AmmanConfig::new().set_validator(ValidatorConfig {
            kill_running_validators: true,
            ..Default::default()
        }));
        roundtrip(&AmmanConfig::new().set_validator(ValidatorConfig {
            kill_running_validators: true,
            accounts: Some(vec![Account {
                label: Some("loaded account".to_string()),
                account_id: "13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu".to_string(),
                ..Default::default()
            }]),
            ..Default::default()
        }));
    }
}
