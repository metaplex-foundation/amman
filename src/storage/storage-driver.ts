import type { Metaplex, SolAmount } from '@metaplex-foundation/js-next'
import { MetaplexFile } from '@metaplex-foundation/js-next'
import fetch from 'cross-fetch'

export abstract class Driver {
  protected readonly metaplex: Metaplex

  constructor(metaplex: Metaplex) {
    this.metaplex = metaplex
  }
}

export abstract class StorageDriver extends Driver {
  public abstract getPrice(...files: MetaplexFile[]): Promise<SolAmount>
  public abstract upload(file: MetaplexFile): Promise<string>

  public async uploadAll(files: MetaplexFile[]): Promise<string[]> {
    const promises = files.map((file) => this.upload(file))

    return Promise.all(promises)
  }

  public async uploadJson<T extends object>(json: T): Promise<string> {
    return this.upload(MetaplexFile.fromJson(json))
  }

  public async download(
    uri: string,
    options?: RequestInit
  ): Promise<MetaplexFile> {
    const response = await fetch(uri, options)
    const buffer = await response.arrayBuffer()

    return new MetaplexFile(buffer, uri)
  }

  public async downloadJson<T extends object>(
    uri: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(uri, options)

    return await response.json()
  }
}
