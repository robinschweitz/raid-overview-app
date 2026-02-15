import React, { useState, useEffect } from 'react';
import { sheetsService } from './sheetsService';
import type { PointsData, GroupOverview } from './types';
import './Dashboard.css';

type TabType = 'overview' | 'points' | 'stats' | 'current-loot' | 'raid-archive';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [pointsData, setPointsData] = useState<PointsData[]>([]);
  const [groupOverview, setGroupOverview] = useState<GroupOverview[]>([]);
  const [raidStats, setRaidStats] = useState<any>(null);
  const [raidArchive, setRaidArchive] = useState<any[]>([]);
  const [lootArchive, setLootArchive] = useState<any[]>([]);
  const [currentRaidLoot, setCurrentRaidLoot] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerLootHistory, setPlayerLootHistory] = useState<any[]>([]);
  const [playerCharacters, setPlayerCharacters] = useState<any[]>([]);
  const [selectedRaid, setSelectedRaid] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      console.log('🔄 Starting data fetch...');

      const [members, points, groups, stats, raidArchiveData, lootArchiveData, currentLoot] = await Promise.all([
        sheetsService.getRaidSetup(),
        sheetsService.getPointsData(),
        sheetsService.getGroupOverview(),
        sheetsService.getRaidStats(),
        sheetsService.getRaidArchive(),
        sheetsService.getLootArchive(),
        sheetsService.getCurrentRaidLoot(),
      ]);

      console.log('✅ Data fetched successfully:');
      console.log('- Members:', members.length);
      console.log('- Points:', points.length);
      console.log('- Groups:', groups.length);
      console.log('- Stats:', stats);
      console.log('- Raid Archive:', raidArchiveData.length);
      console.log('- Loot Archive:', lootArchiveData.length);
      console.log('- Current Raid Loot:', currentLoot.length);

      setPointsData(points);
      setGroupOverview(groups);
      setRaidStats(stats);
      setRaidArchive(raidArchiveData);
      setLootArchive(lootArchiveData);
      setCurrentRaidLoot(currentLoot);
      setError(null);
    } catch (err) {
      setError('Failed to fetch data from Google Sheets');
      console.error('❌ Fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial data load
    fetchAllData();

  //   // Set up automatic refresh every 30 seconds
  //   const interval = setInterval(() => {
  //     fetchAllData();
  //   }, 30000); // 30 seconds

  //   // Cleanup interval on unmount
  //   return () => clearInterval(interval);
  }, []);

  const getClassColor = (className: string): string => {
    const colors: Record<string, string> = {
      'Todesritter': '#C41E3A',
      'Druide': '#FF7C0A',
      'Jäger': '#AAD372',
      'Magier': '#3FC7EB',
      'Paladin': '#F48CBA',
      'Priester': '#FFFFFF',
      'Schamane': '#0070DD',
      'Hexer': '#8788EE',
      'Krieger': '#C69B6D',
      'Rogue': '#FFF468',
    };
    return colors[className] || '#666';
  };

  const getRoleIcon = (role: string): string => {
    switch (role) {
      case 'Tank': return '🛡️';
      case 'Heiler': return '💚';
      case 'Mdd': return '⚔️';
      case 'Rdd': return '🏹';
      default: return '❓';
    }
  };

  const handlePlayerClick = async (playerName: string) => {
    setSelectedPlayer(playerName);
    try {
      const [lootHistory, characters] = await Promise.all([
        sheetsService.getPlayerLootHistory(playerName),
        sheetsService.getPlayerCharacters(playerName)
      ]);
      setPlayerLootHistory(lootHistory);
      setPlayerCharacters(characters);
      setShowPlayerModal(true);
    } catch (error) {
      console.error('Error fetching player data:', error);
      // Still show modal with empty data
      setPlayerLootHistory([]);
      setPlayerCharacters([]);
      setShowPlayerModal(true);
    }
  };

  const closeModal = () => {
    setShowPlayerModal(false);
    setSelectedPlayer(null);
    setPlayerLootHistory([]);
    setPlayerCharacters([]);
  };

  if (loading) {
    return <div className="dashboard-loading">Loading ICC 25 Raid Dashboard...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>ICC 25 Raid Dashboard</h1>
            <p>Montagsraid</p>
          </div>
          <div className="header-controls">
            <button
              className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
              onClick={() => fetchAllData(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? '🔄' : '🔄'} Refresh
            </button>
            {/* {lastUpdated && (
              <div className="last-updated">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )} */}
          </div>
        </div>
      </header>

      <nav className="dashboard-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Raid Overview
        </button>
        <button
          className={activeTab === 'points' ? 'active' : ''}
          onClick={() => setActiveTab('points')}
        >
          Punkte
        </button>
        {/* <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          📈 Statistics
        </button> */}
        <button
          className={activeTab === 'current-loot' ? 'active' : ''}
          onClick={() => setActiveTab('current-loot')}
        >
          Raid Loot
        </button>
        <button
          className={activeTab === 'raid-archive' ? 'active' : ''}
          onClick={() => setActiveTab('raid-archive')}
        >
          Raid Archive
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="tab-content">
            <h2>Raid Gruppen Overview</h2>
            <div className="groups-grid">
              {groupOverview.map((group, index) => (
                <div key={index} className="group-card">
                  <h3>{group.groupName}</h3>
                  <div className="group-info">
                    <span className="member-count">{group.members.length} members</span>
                    {group.draeneiCount > 0 && (
                      <span className="draenei-count">🌟 {group.draeneiCount} Draenei</span>
                    )}
                  </div>
                  {group.buffs && (
                    <div className="group-buffs">
                      <strong>Buffs:</strong> {group.buffs}
                    </div>
                  )}
                  <div className="group-members">
                    {group.members.map((member, idx) => {
                      const playerPoints = pointsData.find(p => p.player === member.player)?.points || 0;
                      return (
                        <div key={idx} className="member-item">
                          <span className="role-icon">{getRoleIcon(member.role)}</span>
                          <span
                            className="member-name"
                            style={{ color: getClassColor(member.class) }}
                          >
                            {member.character}
                          </span>
                          <span className="member-class">({member.class})</span>
                          <span className="member-points">{playerPoints} pts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



        {activeTab === 'points' && (
          <div className="tab-content">
            <h2>Punkte Liste</h2>
            <div className="points-container">
              <div className="points-table-container">
                <table className="points-table">
                  <thead>
                    <tr>
                      <th>Spieler</th>
                      <th>Punkte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsData
                      .sort((a, b) => b.points - a.points)
                      .map((player, index) => (
                        <tr key={index}>
                          <td>
                            <button
                              className="player-link"
                              onClick={() => handlePlayerClick(player.player)}
                            >
                              {player.player}
                            </button>
                          </td>
                          <td className="points-value">{player.points}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && raidStats && (
          <div className="tab-content">
            <h2>Raid Composition Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card large">
                <h3>👥 Total Members</h3>
                <p className="stat-number">{raidStats.totalMembers}</p>
              </div>

              <div className="stat-card">
                <h3>🛡️ Tanks</h3>
                <p className="stat-number">{raidStats.tanks}</p>
              </div>

              <div className="stat-card">
                <h3>💚 Healers</h3>
                <p className="stat-number">{raidStats.healers}</p>
              </div>

              <div className="stat-card">
                <h3>⚔️ Melee DPS</h3>
                <p className="stat-number">{raidStats.melee}</p>
              </div>

              <div className="stat-card">
                <h3>🏹 Ranged DPS</h3>
                <p className="stat-number">{raidStats.ranged}</p>
              </div>

              <div className="stat-card">
                <h3>🌟 Draenei</h3>
                <p className="stat-number">{raidStats.draenei}</p>
              </div>
            </div>

            <div className="stats-sections">
              <div className="stats-section">
                <h3>Class Distribution</h3>
                <div className="class-distribution">
                  {Object.entries(raidStats.classDistribution)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .map(([className, count]) => (
                      <div key={className} className="class-stat">
                        <span
                          className="class-name"
                          style={{ color: getClassColor(className) }}
                        >
                          {className}
                        </span>
                        <span className="class-count">{count as number}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="stats-section">
                <h3>Group Distribution</h3>
                <div className="group-distribution">
                  {Object.entries(raidStats.groupDistribution)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .filter(([group]) => group !== '6') // Exclude Ersatzspieler from stats
                    .map(([group, count]) => (
                      <div key={group} className="group-stat">
                        <span className="group-name">Gruppe {group}</span>
                        <span className="group-count">{count as number} members</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

{activeTab === 'raid-archive' && (
  <div className="tab-content">
    <h2>Raid Archive</h2>
    <div className="raid-archive">
      {!selectedRaid ? (
        // Raid List View
        <div className="raid-list">
          <h3>Verfügbare Raids</h3>
          {raidArchive.length > 0 ? (
            <div className="raid-summary-grid">
              {raidArchive.map((raid: any, index: number) => (
                <div
                  key={index}
                  className="raid-summary-card"
                  onClick={() => setSelectedRaid(raid)}
                >
                  <div className="raid-summary-header">
                    <h4>{raid.id}</h4>
                    <span className="raid-date">{raid.date}</span>
                  </div>
                  <div className="raid-summary-stats">
                    <span className="raid-members-count">{raid.members.length} members</span>
                    <span className="raid-loot-count">
                      {lootArchive.filter((loot: any) => loot.raidId === raid.id).length} loot items
                    </span>
                  </div>
                  <div className="raid-click-hint">Click to view details</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-archive">
              <p>No raid sessions found in archive.</p>
              {/* <p>Make sure your "Raid Archive" sheet contains historical raid data.</p> */}
            </div>
          )}
        </div>
      ) : (
        // Raid Detail View
        <div className="raid-detail">
          <div className="raid-detail-header">
            <button
              className="back-button"
              onClick={() => setSelectedRaid(null)}
            >
              ← Zurück
            </button>
            <h3>Raid Session: {selectedRaid.id} - {selectedRaid.date}</h3>
          </div>

          <div className="raid-detail-content">
            {/* Raid Setup Section */}
            <div className="raid-detail-section">
              <h4>Raid Setup</h4>
              <div className="raid-members">
                <div className="members-list">
                  {selectedRaid.members
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((member: any, idx: number) => (
                    <div key={idx} className="archive-member">
                      <span className="member-position">#{member.position}</span>
                      <span className="role-icon">{getRoleIcon(member.role)}</span>
                      <span className="member-name" style={{ color: getClassColor(member.class) }}>
                        {member.character}
                      </span>
                      <span className="member-role">({member.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Loot History Section */}
            <div className="raid-detail-section">
              <h4>Loot History</h4>
              {lootArchive.filter((loot: any) => loot.raidId === selectedRaid.id).length > 0 ? (
                <div className="raid-loot-history">
                  {lootArchive
                    .filter((loot: any) => loot.raidId === selectedRaid.id)
                    .map((loot: any, index: number) => {
                      const member =
                        (selectedRaid?.members as any[] | undefined)?.find((m: any) => m.character === loot.character) ??
                        { character: loot.character, class: '' };
                      return (
                        <div key={index} className="loot-item">
                          <div className="loot-header">
                            <span className="loot-item-name">{loot.item}</span>
                            <span className="loot-date">{loot.date}</span>
                          </div>
                          <div className="loot-details">
                            <span className="loot-character" style={{ color: getClassColor(member.class) }}>
                              {loot.character}
                            </span>
                            <span className="loot-priority">Priority: {loot.priority}</span>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              ) : (
                <p>No loot distributed in this raid.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)}

        {activeTab === 'current-loot' && (
          <div className="tab-content">
            <h2>Raid Loot</h2>
            <div className="loot-archive">
              {currentRaidLoot.length > 0 ? (
                <div className="loot-table-container">
                  <table className="loot-table">
                    <thead>
                      <tr>
                        <th>Boss</th>
                        <th>Item</th>
                        <th>Charakter</th>
                        <th>Zuweisung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentRaidLoot.map((loot: any, index: number) => (
                        <tr key={index}>
                          <td>
                            {loot.character}
                          </td>
                          <td className="loot-item-cell">{loot.item}</td>
                          <td>{loot.priority}</td>
                          <td>{loot.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-archive">
                  <p>No loot distributed yet.</p>
                  {/* <p>Once Loot was added to the "ICC25 Loot" sheet this will contain loot data.</p> */}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Player Details Modal */}
        {showPlayerModal && selectedPlayer && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content player-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Spieler Details: {selectedPlayer}</h3>
                <button className="modal-close" onClick={closeModal}>×</button>
              </div>
              <div className="modal-body">
                {/* Characters Section */}
                <div className="modal-section">
                  <h4>Charaktere</h4>
                  {playerCharacters.length > 0 ? (
                    <div className="player-characters">
                      {playerCharacters.map((character: any, index: number) => (
                        <div key={index} className="character-card">
                          <div className="character-header">
                            <span
                              className="character-name"
                              style={{ color: getClassColor(character.class) }}
                            >
                              {character.character}
                            </span>
                          </div>
                          <div className="character-details">
                            <span className="character-class">{character.class}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No characters found for this player.</p>
                  )}
                </div>

                {/* Loot History Section */}
                <div className="modal-section">
                  <h4>Loot History</h4>
                  {playerLootHistory.length > 0 ? (
                    <div className="loot-history">
                      {playerLootHistory.map((loot: any, index: number) => {
                        const character = playerCharacters.find(c => c.character === loot.character) || { character: loot.character, class: '' };
                        return (
                          <div key={index} className="loot-item">
                            <div className="loot-header">
                              <span className="loot-item-name">{loot.item}</span>
                              <span className="loot-date">{loot.date}</span>
                            </div>
                            <div className="loot-details">
                              <span className="loot-character" style={{ color: getClassColor(character.class) }}>
                                {loot.character}
                              </span>
                              <span className="loot-raid">Raid: {loot.raidId}</span>
                              <span className="loot-priority">Priority: {loot.priority}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No loot history found for this player.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;