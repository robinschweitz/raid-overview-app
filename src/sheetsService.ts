import type { SheetData, DashboardData, RaidMember, PointsData, GroupOverview } from './types';

// For public sheets - replace with your API key
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY ?? '';

// Google Sheets API base URL
const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsService {
  private spreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID ?? '';

  async getSheetData(spreadsheetId: string, range: string): Promise<DashboardData> {
    try {
      const url = `${SHEETS_API_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        return { rows: [], headers: [] };
      }

      const headers = rows[0];
      const dataRows = rows.slice(1).map((row: any[]) => {
        const obj: SheetData = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      return {
        rows: dataRows,
        headers,
      };
    } catch (error) {
      console.error('Error fetching sheet data:', error);
      throw error;
    }
  }

  async getRaidSetup(): Promise<RaidMember[]> {
    // Fetch the entire raid setup table B1:J41
    const data = await this.getSheetData(this.spreadsheetId, 'ICC25 Raidsetup!B1:J41');
    console.log('Raw raid data headers:', data.headers);
    console.log('Total rows fetched:', data.rows.length);

    return data.rows.map((row, index) => {
      const rowNumber = index + 2; // Row numbers start from 2 (after headers)
      const rowCategory: 'definite' | 'ersatz' | 'unsure' = rowNumber <= 25 ? 'definite' : rowNumber <= 31 ? 'ersatz' : 'unsure';

      return {
        slot: rowNumber, // Use row number as slot
        character: row[data.headers[0]] || '', // Character name
        player: row[data.headers[1]] || '', // Player name
        class: row[data.headers[2]] || '', // Class
        spec: row[data.headers[3]] || '', // Spec
        role: row[data.headers[4]] || '', // Role
        draenei: row[data.headers[5]] || '', // Draenei
        manualGroup: row[data.headers[6]] || '', // Manual Group
        position: parseInt(row[data.headers[7]] || '0'), // Position
        finalGroup: parseInt(row[data.headers[8]] || '0'), // Final Group
        rowCategory
      };
    }).filter(member => member.character && member.character.trim() !== '');
  }

  async getPointsData(): Promise<PointsData[]> {
    const data = await this.getSheetData(this.spreadsheetId, 'Punkte!A1:E100');
    console.log('Raw points data headers:', data.headers);
    console.log('First few raw points rows:', data.rows.slice(0, 3));

    return data.rows.slice(1).map((row, _index) => ({
      player: row[data.headers[0]] || '',
      points: parseInt(row[data.headers[1]] || '0'),
      tokens: row[data.headers[4]] || '',
    })).filter(player => player.player && player.player.trim() !== '');
  }

  async getGroupOverview(): Promise<GroupOverview[]> {
    const allMembers = await this.getRaidSetup();
    const groups: GroupOverview[] = [];

    // Initialize groups 1-5
    for (let i = 1; i <= 5; i++) {
      groups.push({
        groupName: `Gruppe ${i}`,
        members: [],
        buffs: '',
        draeneiCount: 0,
      });
    }

    // Initialize Ersatzspieler group
    groups.push({
      groupName: 'Ersatzspieler',
      members: [],
      buffs: '',
      draeneiCount: 0,
    });

    // Process all members and assign them to groups
    allMembers.forEach(member => {
      if (member.finalGroup >= 1 && member.finalGroup <= 5) {
        // Has a final group assignment (1-5)
        groups[member.finalGroup - 1].members.push(member);
      } else {
        // No final group assignment
        if (member.rowCategory === 'ersatz') {
          // Ersatzspieler (rows 27-31) without final group go to Ersatzspieler group
          groups[5].members.push(member);
        }
        // Unsure players (rows 32-41) without final group are not shown
      }
    });

    // Update draenei counts and fetch buff info for groups 1-5
    for (let i = 0; i < 5; i++) {
      groups[i].draeneiCount = groups[i].members.filter(member => member.draenei === 'Ja').length;

      // Get buff info from Raid-Overview sheet
      try {
        const overviewData = await this.getSheetData(this.spreadsheetId, 'Raid-Overview!A1:I10');
        const groupRow = overviewData.rows.find(row =>
          row['ICC25 Gruppenansicht']?.includes(`Gruppe ${i + 1}`)
        );
        if (groupRow) {
          groups[i].buffs = groupRow['Raid Buffs'] || '';
        }
      } catch (error) {
        console.warn('Could not fetch buff info for group', i + 1);
      }
    }

    // Update draenei count for Ersatzspieler
    groups[5].draeneiCount = groups[5].members.filter(member => member.draenei === 'Ja').length;

    // Remove empty groups (except Ersatzspieler which we always want to show)
    return groups.filter((group, index) => index === 5 || group.members.length > 0);
  }

  async getPlayerCharacters(playerName: string): Promise<any[]> {
    const data = await this.getSheetData(this.spreadsheetId, 'Charaktere!A1:C100');
    console.log('Raw characters data headers:', data.headers);
    console.log('First few raw character rows:', data.rows.slice(0, 5));

    return data.rows.slice(1)
      .filter((row: any) => row[data.headers[1]] === playerName) // Filter by player name
      .map((row: any) => ({
        character: row[data.headers[0]] || '',
        player: row[data.headers[1]] || '',
        class: row[data.headers[2]] || '',
      }))
      .filter(char => char.character && char.character.trim() !== '');
  }

  async getPlayerLootHistory(playerName: string): Promise<any[]> {
    // First get all characters for this player
    const playerCharacters = await this.getPlayerCharacters(playerName);
    const characterNames = playerCharacters.map((char: any) => char.character);

    console.log('Player characters for loot lookup:', characterNames);

    // Then get loot archive and filter by character names
    const lootData = await this.getSheetData(this.spreadsheetId, 'Loot Archive!A1:E1000');
    console.log('Raw loot archive data headers:', lootData.headers);
    console.log('First few raw loot rows:', lootData.rows.slice(0, 3));

    return lootData.rows.slice(0)
      .filter((row: any) => characterNames.includes(row[lootData.headers[2]])) // Filter by character name
      .map((row: any) => ({
        raidId: row[lootData.headers[0]] || '',
        date: row[lootData.headers[1]] || '',
        character: row[lootData.headers[2]] || '',
        item: row[lootData.headers[3]] || '',
        priority: row[lootData.headers[4]] || '',
      }))
      .filter(loot => loot.item && loot.item.trim() !== '')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getRaidArchive(): Promise<any[]> {
    // Fetch raw data directly from the API to avoid processing issues
    const response = await fetch(`${SHEETS_API_URL}/${this.spreadsheetId}/values/Raid%20Archive!A1:Z1000?key=${API_KEY}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    const rows = rawData.values || [];

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0];
    console.log('Raid archive headers:', headers);
    console.log('First data row:', rows[1]);

    // Group by raid ID
    const raids: any[] = [];
    let currentRaid: any = null;

    rows.slice(1).forEach((row: any[]) => {
      const raidId = row[0]; // Raid ID (column A)
      const timestamp = row[1]; // Timestamp (column B)
      const position = row[2]; // Position (column C)
      const character = row[3]; // Character (column D)
      const role = row[4]; // Role (column E)

      if (raidId && raidId !== currentRaid?.id) {
        if (currentRaid) {
          raids.push(currentRaid);
        }
        currentRaid = {
          id: raidId,
          date: timestamp || '',
          members: [],
          loot: []
        };
      }
      if (currentRaid && character) { // Character name exists
        currentRaid.members.push({
          character: character || '',
          role: role || '',
          position: parseInt(position || '0'),
        });
      }
    });

    if (currentRaid) {
      raids.push(currentRaid);
    }

    console.log('Processed raids:', raids.length);
    if (raids.length > 0) {
      console.log('First raid members:', raids[0].members.length);
      console.log('First few members:', raids[0].members.slice(0, 3));
    }

    return raids;
  }

  async getLootArchive(): Promise<any[]> {
    // Fetch raw data directly to match actual sheet structure
    const response = await fetch(`${SHEETS_API_URL}/${this.spreadsheetId}/values/Loot%20Archive!A1:E1000?key=${API_KEY}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    const rows = rawData.values || [];

    if (rows.length < 2) {
      return [];
    }

    console.log('Loot archive headers:', rows[0]);
    console.log('First loot row:', rows[1]);

    return rows.slice(1)
      .map((row: any[]) => ({
        raidId: row[0] || '',
        date: row[1] || '',
        character: row[2] || '',
        item: row[3] || '',
        priority: row[4] || '',
      }))
      .filter((loot: any) => loot.item && loot.item.trim() !== '')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getCurrentRaidLoot(): Promise<any[]> {
    // Fetch current raid loot from ICC25 Loot sheet
    const response = await fetch(`${SHEETS_API_URL}/${this.spreadsheetId}/values/ICC25%20Loot!A1:E1000?key=${API_KEY}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    const rows = rawData.values || [];

    if (rows.length < 2) {
      return [];
    }

    console.log('Current raid loot headers:', rows[0]);
    console.log('First loot row:', rows[1]);

    return rows.slice(1)
      .map((row: any[]) => ({
        character: row[0] || '',
        item: row[1] || '',
        priority: row[2] || '',
        date: row[3] || '',
        notes: row[4] || '',
      }))
      .filter((loot: any) => loot.item && loot.item.trim() !== '');
  }

  async getRaidStats() {
    const allMembers = await this.getRaidSetup();

    // Only count members that are in the first 5 groups (not Ersatzspieler)
    const raidMembers = allMembers.filter(member => {
      return member.finalGroup >= 1 && member.finalGroup <= 5;
    });

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

    // Class distribution
    raidMembers.forEach(member => {
      stats.classDistribution[member.class] = (stats.classDistribution[member.class] || 0) + 1;
    });

    // Group distribution (only groups 1-5)
    raidMembers.forEach(member => {
      stats.groupDistribution[member.finalGroup] = (stats.groupDistribution[member.finalGroup] || 0) + 1;
    });

    return stats;
  }
}

export const sheetsService = new SheetsService();
