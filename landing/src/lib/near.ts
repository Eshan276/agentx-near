// Read-only NEAR RPC helpers for the landing page: everything shown as "live" comes from the
// deployed game contract, not from made-up numbers.
import { useEffect, useState } from 'react';
import { CONTRACT_ID } from '../site';

const RPCS = ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org'];
export const GOLD = 10n ** 18n;

export async function view<T>(method: string, args: Record<string, unknown> = {}, contractId = CONTRACT_ID): Promise<T> {
  let lastErr: unknown;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'agentx', method: 'query',
          params: { request_type: 'call_function', finality: 'optimistic', account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
        }),
      });
      const j = await res.json();
      if (j.error || j.result?.error) throw new Error(j.error?.message ?? j.result.error);
      return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export interface PoolView { resource_id: string; reserve_resource: string; reserve_gold: string; price: string }
export interface AgentView { account_id: string; registered_at_ms: number; sell_nonce: number; swaps: number; volume: string; gold: string }
export interface ConfigView { owner_id: string; voucher_public_key: string; agents: number; pools: number; fee_bps: number; starting_gold: string }

/** GGLD base units (string) → number with `dp` decimals. */
export const gold = (base: string | bigint, dp = 2) => Number((BigInt(base) * 10n ** BigInt(dp)) / GOLD) / 10 ** dp;

export interface NearStats {
  status: 'loading' | 'live' | 'down';
  config?: ConfigView;
  pools: PoolView[];
  agents: AgentView[];
  supply?: number;      // GGLD
  swaps: number;        // sum over registered agents
  volume: number;       // GGLD
  updatedAt?: Date;
}

// One shared poller for the whole page: every section subscribes to the same snapshot.
let snapshot: NearStats = { status: 'loading', pools: [], agents: [], swaps: 0, volume: 0 };
const listeners = new Set<(s: NearStats) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

async function load() {
  try {
    const [config, pools, agents, supply] = await Promise.all([
      view<ConfigView>('get_config'),
      view<PoolView[]>('get_pools'),
      view<AgentView[]>('get_agents', { from_index: 0, limit: 100 }),
      view<string>('ft_total_supply'),
    ]);
    snapshot = {
      status: 'live', config, pools, agents, supply: gold(supply, 0),
      swaps: agents.reduce((n, a) => n + a.swaps, 0),
      volume: agents.reduce((n, a) => n + gold(a.volume), 0),
      updatedAt: new Date(),
    };
  } catch {
    snapshot = { ...snapshot, status: snapshot.status === 'live' ? 'live' : 'down' };
  }
  listeners.forEach((l) => l(snapshot));
}

/** Live view of the game contract, refreshed every 15 s while any component is mounted. */
export function useNearStats(): NearStats {
  const [s, setS] = useState<NearStats>(snapshot);
  useEffect(() => {
    listeners.add(setS);
    if (!timer) { load(); timer = setInterval(load, 15000); }
    else setS(snapshot);
    return () => {
      listeners.delete(setS);
      if (listeners.size === 0 && timer) { clearInterval(timer); timer = undefined; }
    };
  }, []);
  return s;
}
