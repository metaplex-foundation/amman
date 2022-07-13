import { PersistedAccountInfo } from '@metaplex-foundation/amman-client'
import { Keypair, PublicKey } from '@solana/web3.js'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AccountPersister, mapPersistedAccountInfos } from '../assets'
import {
  restartValidatorWithAccountOverrides,
  restartValidatorWithSnapshot,
} from '../validator'
import { AmmanState } from '../validator/types'

export class RelayHandler {
  constructor(
    readonly accountProvider: AccountProvider,
    readonly accountPersister: AccountPersister,
    readonly snapshotPersister: AccountPersister,
    readonly ammanState: AmmanState,
    private _accountStates: AccountStates,
    // Keyed pubkey:label
    private readonly _allKnownLabels: Record<string, string> = {}
  ) {}

  // -----------------
  // Account States
  // -----------------
  get accountStates() {
    return this._accountStates
  }

  requestAccountStates(pubkey: string): [string, any] {
    const states = this.accountStates.get(pubkey)?.relayStates
    return [pubkey, states ?? []]
  }

  // -----------------
  // Address Labels
  // -----------------
  get allKnownLabels() {
    return this._allKnownLabels
  }

  updateAddressLabels(labels: Record<string, string>) {
    for (const [key, val] of Object.entries(labels)) {
      this._allKnownLabels[key] = val
    }
    this.accountStates.labelKeypairs(this._allKnownLabels)
  }

  // -----------------
  // Amman Version
  // -----------------
  async requestAmmanVersion() {}

  // -----------------
  // Validator Pid
  // -----------------
  requestValidatorPid() {
    const pid = this.ammanState.validator.pid
    if (pid == null) {
      return {
        err: 'It seems like no validator is running currently, cannot get pid',
      }
    }
    return { result: pid }
  }

  // -----------------
  // Save Account
  // -----------------
  async requestAccountSave(pubkey: string, slot?: number) {
    try {
      let data
      if (slot != null) {
        data = this.accountStates.accountDataForSlot(pubkey, slot)
      }
      const accountPath = await this.accountPersister.saveAccount(
        new PublicKey(pubkey),
        this.accountProvider.connection,
        data
      )
      return [pubkey, { accountPath }]
    } catch (err) {
      return [pubkey, { err }]
    }
  }

  // -----------------
  // Snapshot
  // -----------------
  async requestSnapshotSave(label: string) {
    try {
      const addresses = this.accountStates.allAccountAddresses()
      const snapshotDir = await this.snapshotPersister.snapshot(
        label,
        addresses,
        this.allKnownLabels,
        this.accountStates.allKeypairs
      )
      return { snapshotDir }
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  async requestLoadSnapshot(label: string) {
    try {
      const { persistedAccountInfos, persistedSnapshotAccountInfos, keypairs } =
        await restartValidatorWithSnapshot(
          this.accountStates,
          this.ammanState,
          label
        )

      const accountInfos = mapPersistedAccountInfos([
        ...persistedAccountInfos,
        ...persistedSnapshotAccountInfos,
      ])

      this._accountStates = AccountStates.createInstance(
        this.accountProvider.connection,
        this.accountProvider,
        accountInfos,
        keypairs
      )

      return {}
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  // -----------------
  // Keypair
  // -----------------
  requestStoreKeypair(id: string, secretKey: Uint8Array) {
    try {
      const keypair = Keypair.fromSecretKey(secretKey)
      this.accountStates.storeKeypair(id, keypair)
      return {}
    } catch (err: any) {
      return { err: err.toString() }
    }
  }

  requestLoadKeypair(id: string) {
    const keypair = this.accountStates.getKeypairById(id)
    return [id, keypair?.secretKey]
  }

  // -----------------
  // Set Account
  // -----------------
  async requestSetAccount(account: PersistedAccountInfo) {
    const addresses = this.accountStates.allAccountAddresses()
    try {
      const { persistedAccountInfos, persistedSnapshotAccountInfos, keypairs } =
        await restartValidatorWithAccountOverrides(
          this.accountStates,
          this.ammanState,
          addresses,
          this.allKnownLabels,
          this.accountStates.allKeypairs,
          new Map([[account.pubkey, account]])
        )

      const accountInfos = mapPersistedAccountInfos([
        ...persistedAccountInfos,
        ...persistedSnapshotAccountInfos,
      ])

      this._accountStates = AccountStates.createInstance(
        this.accountProvider.connection,
        this.accountProvider,
        accountInfos,
        keypairs
      )
      return {}
    } catch (err: any) {
      return { err: err.toString() }
    }
  }
}
