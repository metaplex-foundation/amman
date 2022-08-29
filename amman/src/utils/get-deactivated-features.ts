import { spawnSync } from 'child_process'


export async function getDeactivatedFeatures(url: string) {
    const child = spawnSync(`solana`, [
        'feature',
        'status',
        '--display-all',
        '--url', url.charAt(0),
        '--output', 'json'
    ])
    try {
        const features = JSON.parse(child.stdout.toString())['features'] as { id: string, description: string, status: string }[]
        return features.filter(f => f.status === 'inactive').map(f => f.id)
    } catch (err) {
        throw new Error(`Could not parse output from solana feature status: ${err}`)
    }
}