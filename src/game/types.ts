export type ZoneId = 'turbine' | 'cryo' | 'foundry' | 'tesla' | 'core';

export type CameraMode = 'first' | 'third';

export type RepairKind = 'panel' | 'valve' | 'conduit' | 'press';

export interface ZoneInfo {
  id: ZoneId;
  index: number;
  titleTr: string;
  titleEn: string;
  zStart: number;
  zEnd: number;
  spawnPos: [number, number, number];
  notebookNote: string;
  hazardNote: string;
}

export interface RepairStatus {
  id: string;
  zoneId: ZoneId;
  kind: RepairKind;
  label: string;
  progress: number;
  repaired: boolean;
}

export interface GameSnapshot {
  started: boolean;
  cameraMode: CameraMode;
  currentZone: ZoneId;
  health: number;
  maxHealth: number;
  voltage: number;
  isRepairing: boolean;
  activeRepairLabel: string | null;
  activeRepairProgress: number;
  nearbyPrompt: string | null;
  heldObjectName: string | null;
  grappleReady: boolean;
  notebookOpen: boolean;
  muted: boolean;
  pointerLocked: boolean;
  repairs: RepairStatus[];
  enemiesDefeated: number;
  totalEnemies: number;
  bossHealth: number;
  bossMaxHealth: number;
  bossActive: boolean;
  bossDefeated: boolean;
  victory: boolean;
  playerDefeated: boolean;
}

export const ZONES: ZoneInfo[] = [
  {
    id: 'turbine',
    index: 1,
    titleTr: 'Ana Güç İstasyonu ve Türbin Salonu',
    titleEn: 'The Turbine Hall',
    zStart: 10,
    zEnd: -34,
    spawnPos: [0, 0, 2],
    notebookNote: 'Ana buhar hattı vanasını sık, alt dağıtım panosunu Volt-Maul ile yeniden başlat.',
    hazardNote: 'Yüksek basınçlı buhar sızıntısı ve devriye otomatları.',
  },
  {
    id: 'cryo',
    index: 2,
    titleTr: 'Soğutma Kuleleri ve Kriyojenik Mahzen',
    titleEn: 'The Cryo-Vaults',
    zStart: -34,
    zEnd: -68,
    spawnPos: [0, 0, -38],
    notebookNote: 'Sıvı azot manifoldu donmuş. Kaygan buz zeminde dengeni koru, vanayı aç.',
    hazardNote: 'Düşük sürtünmeli buz zemini ve kriyo-dronlar.',
  },
  {
    id: 'foundry',
    index: 3,
    titleTr: 'Silikon ve Devre Dökümhanesi',
    titleEn: 'The Silicon Foundry',
    zStart: -68,
    zEnd: -104,
    spawnPos: [0, 0, -72],
    notebookNote: 'Hidrolik pres şalterlerine vurarak ağır çelik zırhlı muhafızları ezebilirsin.',
    hazardNote: 'Erimiş silikon potaları, kıvılcım yağmuru ve ağır muhafızlar.',
  },
  {
    id: 'tesla',
    index: 4,
    titleTr: 'Yüksek Voltaj İletim Köprüleri',
    titleEn: 'The Tesla Viaduct',
    zStart: -104,
    zEnd: -142,
    spawnPos: [0, 0, -108],
    notebookNote: 'Çökmüş köprü boşluğunu aşmak için yukarıdaki bakır borulara Q ile manyetik kanca at.',
    hazardNote: 'Kontrolsüz Tesla arkları ve derin yeraltı uçurumu.',
  },
  {
    id: 'core',
    index: 5,
    titleTr: 'Çekirdek Komuta Merkezi',
    titleEn: 'The Sovereign Core',
    zStart: -142,
    zEnd: -188,
    spawnPos: [0, 0, -148],
    notebookNote: 'Kalkan devrelerini lehimleyip aşırı yükle; ardından Merkezi Savunma Otomatını parçala.',
    hazardNote: 'Merkezi Savunma Otomatı (The Rogue Mainframe) ve dönen veri diskleri.',
  },
];
