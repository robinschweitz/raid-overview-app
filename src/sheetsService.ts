import type { SheetData, DashboardData, RaidMember, PointsData, GroupOverview } from './types';

// For public sheets - replace with your API key
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY ?? '';

// Google Sheets API base URL
const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

type CacheEntry<T> = { expiresAt: number; promise: Promise<T> };
type GetOpts = { force?: boolean; ttlMs?: number };

export interface LootData {
  currentRaidLoot: any[];
  lootArchive: any[];
}

export class SheetsService {
  private spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID ?? '';

  // Simple in-memory promise cache to dedupe identical requests (including concurrent ones)
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtlMs = 30_000; // 30s
  private lootCache: LootData | null = null;

  private cached<T>(key: string, fetcher: () => Promise<T>, opts?: GetOpts): Promise<T> {
    const now = Date.now();
    const force = opts?.force ?? false;
    const ttlMs = opts?.ttlMs ?? this.defaultTtlMs;

    const hit = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!force && hit && hit.expiresAt > now) return hit.promise;

    const promise = fetcher().catch(err => {
      // Don't cache failures
      this.cache.delete(key);
      throw err;
    });

    this.cache.set(key, { expiresAt: now + ttlMs, promise });
    return promise;
  }

  /** Low-level: fetch a single range and normalize to {headers, rows} */
  async getSheetData(spreadsheetId: string, range: string, opts?: GetOpts): Promise<DashboardData> {
    const key = `values:${spreadsheetId}:${range}`;
    return this.cached(
      key,
      async () => {
        const url = `${SHEETS_API_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const rows = data.values || [];

        if (rows.length === 0) return { rows: [], headers: [] };

        const headers = rows[0];
        const dataRows = rows.slice(1).map((row: any[]) => {
          const obj: SheetData = {};
          headers.forEach((header: string, index: number) => {
            obj[header] = row[index] ?? '';
          });
          return obj;
        });

        return { rows: dataRows, headers };
      },
      opts
    );
  }

  /** Fetch many ranges in ONE network request */
  async batchGet(ranges: string[], opts?: GetOpts): Promise<any> {
    const key = `batchGet:${this.spreadsheetId}:${ranges.join('|')}`;
    return this.cached(
      key,
      async () => {
        const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
        const url = `${SHEETS_API_URL}/${this.spreadsheetId}/values:batchGet?${params}&key=${API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      },
      opts
    );
  }

  // ------------------------
  // Parsing helpers
  // ------------------------

  private valuesToDashboardData(values: any[][]): DashboardData {
    if (!values || values.length === 0) return { rows: [], headers: [] };
    const headers = values[0] ?? [];
    const rows = (values.slice(1) ?? []).map((row: any[]) => {
      const obj: SheetData = {};
      headers.forEach((h: string, i: number) => (obj[h] = row?.[i] ?? ''));
      return obj;
    });
    return { headers, rows };
  }

  private parseRaidSetup(data: DashboardData): RaidMember[] {
    return data.rows
      .map((row, index) => {
        const rowNumber = index + 2; // Row numbers start from 2 (after headers)
        const rowCategory: 'definite' | 'ersatz' | 'unsure' =
          rowNumber <= 25 ? 'definite' : rowNumber <= 31 ? 'ersatz' : 'unsure';

        return {
          slot: rowNumber,
          character: row[data.headers[0]] || '',
          player: row[data.headers[1]] || '',
          class: row[data.headers[2]] || '',
          spec: row[data.headers[3]] || '',
          role: row[data.headers[4]] || '',
          draenei: row[data.headers[5]] || '',
          manualGroup: row[data.headers[6]] || '',
          position: parseInt((row[data.headers[7]] as string) || '0'),
          finalGroup: parseInt((row[data.headers[8]] as string) || '0'),
          rowCategory
        } as RaidMember;
      })
      .filter(member => member.character && member.character.trim() !== '');
  }

  private parsePoints(data: DashboardData): PointsData[] {
    return data.rows
      .map((row) => ({
        player: row[data.headers[0]] || '',
        points: parseInt((row[data.headers[1]] as string) || '0'),
        tokens: row[data.headers[4]] || '',
      }))
      .filter(p => p.player && p.player.trim() !== '');
  }

  private buildGroupOverview(members: RaidMember[], overviewData?: DashboardData): GroupOverview[] {
    const groups: GroupOverview[] = [];

    // Initialize groups 1-5
    for (let i = 1; i <= 5; i++) {
      groups.push({ groupName: `Gruppe ${i}`, members: [], buffs: '', draeneiCount: 0 });
    }

    // Initialize Ersatzspieler group
    groups.push({ groupName: 'Ersatzspieler', members: [], buffs: '', draeneiCount: 0 });

    // Assign members to groups
    members.forEach(member => {
      if (member.finalGroup >= 1 && member.finalGroup <= 5) {
        groups[member.finalGroup - 1].members.push(member);
      } else if (member.rowCategory === 'ersatz') {
        groups[5].members.push(member);
      }
    });

    // Draenei counts + buffs
    for (let i = 0; i < 5; i++) {
      groups[i].draeneiCount = groups[i].members.filter(m => m.draenei === 'Ja').length;

      if (overviewData) {
        const groupRow = overviewData.rows.find(row =>
          (row['ICC25 Gruppenansicht'] as string | undefined)?.includes(`Gruppe ${i + 1}`)
        );
        if (groupRow) groups[i].buffs = (groupRow['Raid Buffs'] as string) || '';
      }
    }

    groups[5].draeneiCount = groups[5].members.filter(m => m.draenei === 'Ja').length;

    return groups.filter((g, idx) => idx === 5 || g.members.length > 0);
  }

  private buildRaidStats(members: RaidMember[]) {
    const raidMembers = members.filter(m => m.finalGroup >= 1 && m.finalGroup <= 5);

    const stats = {
      totalMembers: raidMembers.length,
      tanks: raidMembers.filter(m => m.role === 'Tank').length,
      healers: raidMembers.filter(m => m.role === 'Heiler').length,
      melee: raidMembers.filter(m => m.role === 'Mdd').length,
      ranged: raidMembers.filter(m => m.role === 'Rdd').length,
      draenei: raidMembers.filter(m => m.draenei === 'Ja').length,
      classDistribution: {} as Record<string, number>,
      groupDistribution: {} as Record<number, number>,
    };

    raidMembers.forEach(member => {
      stats.classDistribution[member.class] = (stats.classDistribution[member.class] || 0) + 1;
      stats.groupDistribution[member.finalGroup] = (stats.groupDistribution[member.finalGroup] || 0) + 1;
    });

    return stats;
  }

  private parseRaidArchiveFromValues(values: any[][]): any[] {
    const rows = values || [];
    if (rows.length < 2) return [];

    const raids: any[] = [];
    let currentRaid: any = null;

    rows.slice(1).forEach((row: any[]) => {
      const raidId = row[0];       // A
      const timestamp = row[1];    // B
      const position = row[2];     // C
      const character = row[3];    // D
      const role = row[4];         // E
      const className = row[5];    // F 

      if (raidId && raidId !== currentRaid?.id) {
        if (currentRaid) raids.push(currentRaid);
        currentRaid = { id: raidId, date: timestamp || '', members: [] };
      }

      if (currentRaid && character) {
        currentRaid.members.push({
          character: character || '',
          role: role || '',
          class: className || '',
          position: parseInt(position || '0'),
        });
      }
    });

    if (currentRaid) raids.push(currentRaid);
    return raids;
  }

  private parseLootArchiveFromValues(values: any[][]): any[] {
    const rows = values || [];
    if (rows.length < 2) return [];

    return rows
      .slice(1)
      .map((row: any[]) => ({
        raidId: row[0] || '',
        date: row[1] || '',
        character: row[2] || '',
        item: row[3] || '',
        priority: row[4] || '',
        itemId: row[5] || '',
      }))
      .filter((loot: any) => loot.item && loot.item.trim() !== '')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private parseCurrentLootFromValues(values: any[][]): any[] {
    const rows = values || [];
    if (rows.length < 2) return [];

    return rows
      .slice(1)
      .map((row: any[]) => ({
        boss: row[0] || '',
        character: row[2] || '',
        item: row[1] || '',
        priority: row[3] || '',
        date: 'Current Raid',
        itemId: row[4] || '',
      }))
      .filter((loot: any) => loot.item && loot.item.trim() !== '');
  }

  // ------------------------
  // Public API (existing methods kept)
  // ------------------------

  /** One-call dashboard loader (preferred) */
  async getDashboardBundle(opts?: GetOpts) {
    const ranges = [
      'ICC25 Raidsetup!B1:J41',
      'Punkte!A1:E100',
      'Raid-Overview!A1:I10',
      'Raid Archive!A1:Z1000',
      'Loot Archive!A1:E1000',
      'ICC25 Loot!A1:E1000',
    ];

    const raw = await this.batchGet(ranges, opts);
    const valueRanges = raw.valueRanges ?? [];

    const getValues = (needle: string): any[][] => {
      const hit = valueRanges.find((v: any) => (v.range as string)?.includes(needle));
      return (hit?.values as any[][]) ?? [];
    };

    const raidSetupData = this.valuesToDashboardData(getValues('ICC25 Raidsetup!B1:J41'));
    const pointsData = this.valuesToDashboardData(getValues('Punkte!A1:E100'));
    const overviewData = this.valuesToDashboardData(getValues('Raid-Overview!A1:I10'));

    const members = this.parseRaidSetup(raidSetupData);
    const points = this.parsePoints(pointsData);
    const groups = this.buildGroupOverview(members, overviewData);
    const stats = this.buildRaidStats(members);

    const raidArchive = this.parseRaidArchiveFromValues(getValues('Raid Archive!A1:Z1000'));
    const lootArchive = this.parseLootArchiveFromValues(getValues('Loot Archive!A1:E1000'));
    const currentLoot = this.parseCurrentLootFromValues(getValues('ICC25 Loot!A1:E1000'));

    return { members, points, groups, stats, raidArchive, lootArchive, currentLoot };
  }

  async getRaidSetup(opts?: GetOpts): Promise<RaidMember[]> {
    const data = await this.getSheetData(this.spreadsheetId, 'ICC25 Raidsetup!B1:J41', opts);
    return this.parseRaidSetup(data);
  }

  async getPointsData(opts?: GetOpts): Promise<PointsData[]> {
    const data = await this.getSheetData(this.spreadsheetId, 'Punkte!A1:E100', opts);
    return this.parsePoints(data);
  }

  async getGroupOverview(opts?: GetOpts): Promise<GroupOverview[]> {
    // getRaidSetup is cached/deduped, and Raid-Overview is fetched ONCE.
    const [members, overview] = await Promise.all([
      this.getRaidSetup(opts),
      this.getSheetData(this.spreadsheetId, 'Raid-Overview!A1:I10', opts).catch(() => undefined),
    ]);

    return this.buildGroupOverview(members, overview);
  }

  async getPlayerCharacters(playerName: string, opts?: GetOpts): Promise<any[]> {
    const data = await this.getSheetData(this.spreadsheetId, 'Charaktere!A1:C100', opts);

    return data.rows
      .filter((row: any) => row[data.headers[1]] === playerName)
      .map((row: any) => ({
        character: row[data.headers[0]] || '',
        player: row[data.headers[1]] || '',
        class: row[data.headers[2]] || '',
      }))
      .filter(char => char.character && char.character.trim() !== '');
  }

  async getPlayerLootHistory(playerName: string, playerCharacters?: any[], opts?: GetOpts): Promise<any[]> {
    // Load all loot data if not already cached
    if (!this.lootCache) {
      const [currentLoot, lootArchive] = await Promise.all([
        this.getCurrentRaidLoot(opts),
        this.getLootArchive(opts)
      ]);
      this.lootCache = { currentRaidLoot: currentLoot, lootArchive };
    }

    const chars = playerCharacters ?? (await this.getPlayerCharacters(playerName, opts));
    const characterNames = chars.map((c: any) => c.character);

    // Combine current raid loot and loot archive for the player
    const allLoot = [
      ...this.lootCache.currentRaidLoot.filter(loot => characterNames.includes(loot.character)),
      ...this.lootCache.lootArchive.filter(loot => characterNames.includes(loot.character))
    ];

    return allLoot
      .filter(loot => loot.item && loot.item.trim() !== '')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getRaidArchive(opts?: GetOpts): Promise<any[]> {
    const raw = await this.batchGet(['Raid Archive!A1:Z1000'], opts);
    const values = raw.valueRanges?.[0]?.values ?? [];
    return this.parseRaidArchiveFromValues(values);
  }

  async getLootArchive(opts?: GetOpts): Promise<any[]> {
    const raw = await this.batchGet(['Loot Archive!A1:F1000'], opts);
    const values = raw.valueRanges?.[0]?.values ?? [];
    return this.parseLootArchiveFromValues(values);
  }

  async getCurrentRaidLoot(opts?: GetOpts): Promise<any[]> {
    const raw = await this.batchGet(['ICC25 Loot!A1:E1000'], opts);
    const values = raw.valueRanges?.[0]?.values ?? [];
    return this.parseCurrentLootFromValues(values);
  }

  async getRaidStats(opts?: GetOpts) {
    const members = await this.getRaidSetup(opts);
    return this.buildRaidStats(members);
  }

  /** Optional: clear cache (e.g., before logout) */
  clearCache() {
    this.cache.clear();
    this.lootCache = null;
  }
}

export const sheetsService = new SheetsService();
