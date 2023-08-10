# Amman

**A** **m** odern **man** datory toolbelt to help test solana SDK libraries and apps on a locally
running validator.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents** _generated with [DocToc](https://github.com/thlorenz/doctoc)_

- [API](#api)
- [CLI](#cli)
  - [Commands: start](#commands-start)
- [Example Configs](#example-configs)
  - [Validator/Relay/Storage Config with Defaults](#validatorrelaystorage-config-with-defaults)
  - [Config with Remote Accounts](#config-with-remote-accounts)
  - [Deactivating Test Validator Features](#deactivating-test-validator-features)
    - [Resources](#resources)
- [LICENSE](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## API

Aside from providing a CLI for various tasks, amman also provides commonly used actions,
transactions, asserts and more via an API. Please find the [API docs here](https://metaplex-foundation.github.io/amman/docs/).

## CLI

```sh
amman [command]

Commands:
  amman start    Launches a solana-test-validator and the amman relay and/or
                 mock storage if so configured
  amman stop     Stops the relay and storage and kills the running solana
                 test validator
  amman logs     Launches 'solana logs' and pipes them through a prettifier
  amman airdrop  Airdrops provided Sol to the payer
  amman label    Adds labels for accounts or transactions to amman
  amman account  Retrieves account information for a PublicKey or a label or
                 shows all labeled accounts
  amman run      Executes the provided command after expanding all address
                 labels

Options:
  --help     Show help                                                 [boolean]
  --version  Show version number                                       [boolean]
```

### Commands: start

```sh
amman start <config.js>
```

If no `config.js` is provided _amman_ looks for an `.ammanrc.js` file in the current directory.
If that isn't found either it uses a default config.

The config should be a JavaScript module exporting 'validator' with any of the below
properties:

- killRunningValidators: if true will kill any solana-test-validators currently running on the system.
- programs: bpf programs which should be loaded into the test validator
- accountsCluster: default cluster to clone remote accounts from
- accounts: array of remote accounts to load into the test validator
- jsonRpcUrl: the URL at which the test validator should listen for JSON RPC requests
- websocketUrl: for the RPC websocket
- geyserPluginConfigs: array of geyser plugins config files to plug into the test validator
- ledgerDir: where the solana test validator writes the ledger
- resetLedger: if true the ledger is reset to genesis at startup
- verifyFees: if true the validator is not considered fully started up until it charges transaction fees

## Example Configs

### Validator/Relay/Storage Config with Defaults

Below is an example config with all values set to the defaults except for an added
program and a `relay` and `storage` config.

A _amman-explorer relay_ is launched automatically with the validator unless it is running in a
_CI_ environment and if a relay is already running on the known _relay port_, it is killed
first.

A _mock storage_ is launched only if a `storage` config is provided. In case a storage server
is already running on the known _storage port_, it is killed first.

```js
import { LOCALHOST, tmpLedgerDir } from '@metaplex-foundation/amman'

module.exports = {
  validator: {
    killRunningValidators: true,
    programs: [
      {
        label: 'Token Metadata Program',
        programId: programIds.metadata,
        deployPath: localDeployPath('mpl_token_metadata'),
      },
    ],
    jsonRpcUrl: LOCALHOST,
    websocketUrl: '',
    commitment: 'confirmed',
    ledgerDir: tmpLedgerDir(),
    resetLedger: true,
    verifyFees: false,
    detached: process.env.CI != null,
  },
  relay: {
    enabled: process.env.CI == null,
    killlRunningRelay: true,
  },
  storage: {
    enabled: process.env.CI == null,
    storageId: 'mock-storage',
    clearOnStart: true,
  },
}
```

### Config with Remote Accounts

Below is an example of a config where the accounts are being pulled from a specific RPC endpoint.

```js
module.exports = {
  validator: {
    // By default Amman will pull the account data from the accountsCluster (can be overridden on a per account basis)
    accountsCluster: 'https://api.metaplex.solana.com',
    accounts: [
      {
        label: 'Token Metadata Program',
        accountId: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
        // marking executable as true will cause Amman to pull the executable data account as well automatically
        executable: true,
      },
      {
        label: 'Random other account',
        accountId: '4VLgNs1jXgdciSidxcaLKfrR9WjATkj6vmTm5yCwNwui',
        // By default executable is false and is not required to be in the config
        // executable: false,

        // Providing a cluster here will override the accountsCluster field
        cluster: 'https://metaplex.devnet.rpcpool.com',
      },
    ],
  },
}
```

### Deactivating Test Validator Features

For the different clusters like _devnet_ some features are disabled. By default the locally
running solana-test-validator does not disable any features and thus behaves differently than
the provided clusters.

In order to run tests in a scenario that is closer to how they would run against a specific
cluster you can match the features of it via the _matchFeatures_ config property:

```js
module.exports = {
  validator: {
    ...
    // The below disables any features that are deactivated for the `mainnet-beta` cluster
    matchFeatures: 'mainnet-beta',
  }
}
```

If you want to explicitly disable a set of features you can do so via the _deactivateFeatures_
property:

```js
module.exports = {
  validator: {
    ...
   deactivateFeatures: ['21AWDosvp3pBamFW91KB35pNoaoZVTM7ess8nr2nt53B'],
  }
}
```

**NOTE**: that only one of the above properties can be set

#### Resources

- [test validator runtime features](https://docs.solana.com/developing/test-validator#appendix-ii-runtime-features)
- [runtime new features](https://docs.solana.com/developing/programming-model/runtime#new-features)

## LICENSE

Apache-2.0
