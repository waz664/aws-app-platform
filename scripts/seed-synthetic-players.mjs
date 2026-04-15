import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const ORGANIZATION_ID = 'nc-golden-bears';
const ALLOWED_ENVS = new Set(['dev', 'stage']);
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const DEFAULT_COUNT = 80;
const GOALIE_COUNT = 8;
const DEFENSE_COUNT = 29;
const FORWARD_COUNT = DEFAULT_COUNT - GOALIE_COUNT - DEFENSE_COUNT;

const firstNames = [
  'Aiden',
  'Owen',
  'Liam',
  'Mason',
  'Carter',
  'Declan',
  'Nolan',
  'Lucas',
  'Wyatt',
  'Hudson',
  'Beckett',
  'Logan',
  'Ryan',
  'Gavin',
  'Evan',
  'Cole',
  'Jack',
  'Reid',
  'Sawyer',
  'Graham',
  'Brady',
  'Connor',
  'Landon',
  'Easton',
];

const lastNames = [
  'Miller',
  'Johnson',
  'Bennett',
  'Walsh',
  'Carter',
  'Sullivan',
  'Mercer',
  'Brooks',
  'Dawson',
  'Barrett',
  'Lawson',
  'Turner',
  'Murphy',
  'Henson',
  'Whitaker',
  'Collins',
  'Foster',
  'McLean',
  'McCarthy',
  'Delaney',
  'Callahan',
  'Grady',
  'Porter',
  'Keegan',
  'Harding',
];

const clubNames = [
  'Carolina Knights',
  'Raleigh Raptors',
  'Triangle Thunder',
  'Wake Warriors',
  'Piedmont Pirates',
  'Coastal Cyclones',
  'Lake Norman Wolves',
  'Cary Blaze',
];

const levelLabels = ['AA', 'A', 'Select'];

const nextSeasonOptions = [
  'Strongest daily competition',
  'Expanded team responsibility',
  'Skill development',
  'Physical development',
  'Exposure / advancement',
  'Confidence and consistency',
];

const developmentSettingOptions = [
  'Challenge-forward setting',
  'Balanced-growth setting',
  'Responsibility-forward setting',
  'Open to staff recommendation',
];

const preferredRoleOptions = [
  'Any role in the most challenging setting',
  'Consistent regular role',
  'Expanded responsibility',
  'Open to staff recommendation',
];

const coachingStyleOptions = [
  'Clear standards and direct feedback',
  'Teaching and detail oriented',
  'Confidence-building and encouragement',
  'Balanced mix',
];

const participationOptions = [
  'No known conflicts',
  'Minor scheduling considerations',
  'Significant constraints',
  'Prefer to discuss directly',
];

function parseArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const [flag, inlineValue] = token.split('=', 2);
    if (inlineValue !== undefined) {
      values[flag] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      values[flag] = 'true';
      continue;
    }

    values[flag] = nextToken;
    index += 1;
  }

  return values;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getPositionProfile(index) {
  if (index < GOALIE_COUNT) {
    return {
      primaryPosition: 'Goalie',
      positions: 'Goalie',
      label: 'goalie',
    };
  }

  if (index < GOALIE_COUNT + DEFENSE_COUNT) {
    return {
      primaryPosition: 'Defense',
      positions: 'Defense',
      label: 'defense',
    };
  }

  const forwardIndex = index - GOALIE_COUNT - DEFENSE_COUNT;
  if (forwardIndex % 3 === 0) {
    return {
      primaryPosition: 'Center',
      positions: 'Forward',
      label: 'forward',
    };
  }

  return {
    primaryPosition: 'Wing',
    positions: 'Forward',
    label: 'forward',
  };
}

function getBirthYear(index) {
  return index % 2 === 0 ? '2010' : '2011';
}

function formatPhone(index) {
  return `919-555-${String(1200 + index).padStart(4, '0')}`;
}

function buildTeamHistory(playerId, birthYear, clubName, primaryPosition, rng) {
  const currentLevel = levelLabels[Math.floor(rng() * levelLabels.length)];
  const previousLevel = levelLabels[Math.floor(rng() * levelLabels.length)];
  const oldestLevel = levelLabels[Math.floor(rng() * levelLabels.length)];
  const alternateClub = clubNames[Math.floor(rng() * clubNames.length)];

  return [
    {
      id: `${playerId}-team-1`,
      seasonLabel: '2023-24',
      teamName: `${alternateClub} ${birthYear} ${oldestLevel}`,
      positionPlayed: primaryPosition === 'Center' || primaryPosition === 'Wing' ? 'Forward' : primaryPosition,
    },
    {
      id: `${playerId}-team-2`,
      seasonLabel: '2024-25',
      teamName: `${clubName} ${birthYear} ${previousLevel}`,
      positionPlayed: primaryPosition === 'Center' || primaryPosition === 'Wing' ? 'Forward' : primaryPosition,
    },
    {
      id: `${playerId}-team-3`,
      seasonLabel: '2025-26',
      teamName: `${clubName} ${birthYear} ${currentLevel}`,
      positionPlayed: primaryPosition === 'Center' || primaryPosition === 'Wing' ? primaryPosition : primaryPosition,
    },
  ];
}

function buildPhysicalProfile(index, birthYear, positionLabel, rng) {
  const birthYearAdjustment = birthYear === '2010' ? 1.5 : 0;
  const positionAdjustment =
    positionLabel === 'goalie' ? 2.5 : positionLabel === 'defense' ? 1.0 : 0;
  const rangeAdjustment = (rng() - 0.5) * 7.5;

  let totalInches = 64 + birthYearAdjustment + positionAdjustment + rangeAdjustment;

  if (index < 4) {
    totalInches -= 4.5;
  } else if (index >= DEFAULT_COUNT - 4) {
    totalInches += 4.75;
  }

  totalInches = clamp(Math.round(totalInches), 58, 72);

  const weightBase = birthYear === '2010' ? 118 : 109;
  const weightPositionAdjustment =
    positionLabel === 'goalie' ? 10 : positionLabel === 'defense' ? 6 : 0;
  let weight = weightBase + weightPositionAdjustment + Math.round((rng() - 0.5) * 28);

  if (index < 4) {
    weight -= 10;
  } else if (index >= DEFAULT_COUNT - 4) {
    weight += 14;
  }

  weight = clamp(weight, 88, 178);

  const priorHeightLoss = clamp(1 + Math.round(rng() * 2), 1, 3);
  const priorWeightLoss = clamp(5 + Math.round(rng() * 8), 5, 13);
  const priorTotalInches = clamp(totalInches - priorHeightLoss, 56, 71);
  const priorWeight = clamp(weight - priorWeightLoss, 82, 170);

  return {
    latestHeightFeet: String(Math.floor(totalInches / 12)),
    latestHeightInches: String(totalInches % 12),
    latestWeightPounds: String(weight),
    physicalHistory: [
      {
        id: `measure-${index + 1}-1`,
        recordedAt: '2025-08-15T12:00:00.000Z',
        heightFeet: String(Math.floor(priorTotalInches / 12)),
        heightInches: String(priorTotalInches % 12),
        weightPounds: String(priorWeight),
      },
      {
        id: `measure-${index + 1}-2`,
        recordedAt: '2026-03-15T12:00:00.000Z',
        heightFeet: String(Math.floor(totalInches / 12)),
        heightInches: String(totalInches % 12),
        weightPounds: String(weight),
      },
    ],
  };
}

function buildParticipationNote(participationConsiderations, rng) {
  if (participationConsiderations === 'No known conflicts') return '';
  if (participationConsiderations === 'Minor scheduling considerations') {
    return rng() > 0.5
      ? 'One late-summer weekend is already planned with family.'
      : 'Occasional school travel could affect a few early-season dates.';
  }
  if (participationConsiderations === 'Significant constraints') {
    return rng() > 0.5
      ? 'Shared-family schedule may require advance planning for some weekends.'
      : 'Transportation support will need early communication on select dates.';
  }
  return 'Family would prefer to explain the details directly if needed.';
}

function buildAdditionalInsight(positionLabel, rng) {
  const forwardInsights = [
    'Competes well off the puck and responds to clear, detailed teaching.',
    'Enjoys offensive creativity and is motivated by a bigger role.',
    'Best when practices are fast paced and expectations stay clear.',
    'Confidence grows quickly when feedback is specific and direct.',
  ];
  const defenseInsights = [
    'Takes pride in details, reads rushes well, and responds to accountability.',
    'Shows steady poise with retrievals and values strong teaching habits.',
    'Competes hard around the crease and benefits from consistent structure.',
    'Gap control and puck-moving confidence both trend upward with repetition.',
  ];
  const goalieInsights = [
    'Handles shot volume well and likes clear communication around rebound detail.',
    'Responds best to calm teaching with firm standards and quick resets.',
    'Enjoys technical work and stays engaged when drills include decision-making.',
    'Competes through broken plays and benefits from direct post-save feedback.',
  ];

  const source =
    positionLabel === 'goalie'
      ? goalieInsights
      : positionLabel === 'defense'
        ? defenseInsights
        : forwardInsights;

  return source[Math.floor(rng() * source.length)];
}

function buildProfile(index, env, generatedAt) {
  const birthYear = getBirthYear(index);
  const position = getPositionProfile(index);
  const playerId = `synthetic-${env}-${String(index + 1).padStart(3, '0')}`;
  const rng = createRng(
    index * 4099 + env.charCodeAt(0) * 131 + env.charCodeAt(env.length - 1) * 17,
  );
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[(index * 7) % lastNames.length];
  const playerName = `${firstName} ${lastName}`;
  const handedness = rng() > 0.42 ? 'Left' : 'Right';
  const clubName = clubNames[Math.floor(rng() * clubNames.length)];
  const firstYearPlayingHockey = String(
    birthYear === '2010'
      ? 2014 + Math.floor(rng() * 4)
      : 2015 + Math.floor(rng() * 4),
  );
  const teamHistory = buildTeamHistory(
    playerId,
    birthYear,
    clubName,
    position.primaryPosition,
    rng,
  );
  const currentTeam = teamHistory[teamHistory.length - 1].teamName;
  const physicalProfile = buildPhysicalProfile(index, birthYear, position.label, rng);
  const nextSeasonOutcome = nextSeasonOptions[index % nextSeasonOptions.length];
  const developmentSetting =
    developmentSettingOptions[(index + 1) % developmentSettingOptions.length];
  const preferredRole =
    preferredRoleOptions[(index + 2) % preferredRoleOptions.length];
  const coachingStyle =
    coachingStyleOptions[(index + 3) % coachingStyleOptions.length];
  const participationConsiderations =
    participationOptions[index % participationOptions.length];
  const participationConsiderationsNote = buildParticipationNote(
    participationConsiderations,
    rng,
  );

  return {
    pk: `PLAYER#${playerId}`,
    sk: 'PROFILE',
    entityType: 'Player',
    playerId,
    organizationId: ORGANIZATION_ID,
    createdByUserId: `synthetic-seed-${env}`,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    profile: {
      playerName,
      firstName,
      lastName,
      birthYear,
      gender: 'Male',
      primaryPosition: position.primaryPosition,
      handedness,
      firstYearPlayingHockey,
      currentTeam,
      positions: position.positions,
      completedBy: 'Parent / Guardian',
      bestContactEmail: `family+${env}-${String(index + 1).padStart(3, '0')}@synthetic.ncgoldenbears.test`,
      phoneNumber: formatPhone(index),
      smsOptIn: false,
      teamHistory,
      latestHeightFeet: physicalProfile.latestHeightFeet,
      latestHeightInches: physicalProfile.latestHeightInches,
      latestWeightPounds: physicalProfile.latestWeightPounds,
      physicalHistory: physicalProfile.physicalHistory,
    },
    intake: {
      status: 'submitted',
      updatedAt: generatedAt,
      submittedAt: generatedAt,
      answers: {
        nextSeasonOutcome,
        developmentSetting,
        preferredRole,
        coachingStyle,
        participationConsiderations,
        participationConsiderationsNote,
        additionalInsight: buildAdditionalInsight(position.label, rng),
      },
    },
  };
}

function buildSummary(items) {
  const summary = {
    totalPlayers: items.length,
    birthYears: {},
    primaryPositions: {},
    forwardBucket: 0,
    defenseBucket: 0,
    goalieBucket: 0,
    handedness: {},
  };

  for (const item of items) {
    const birthYear = item.profile.birthYear;
    const primaryPosition = item.profile.primaryPosition;
    const handedness = item.profile.handedness;

    summary.birthYears[birthYear] = (summary.birthYears[birthYear] ?? 0) + 1;
    summary.primaryPositions[primaryPosition] =
      (summary.primaryPositions[primaryPosition] ?? 0) + 1;
    summary.handedness[handedness] = (summary.handedness[handedness] ?? 0) + 1;

    if (primaryPosition === 'Goalie') {
      summary.goalieBucket += 1;
    } else if (primaryPosition === 'Defense') {
      summary.defenseBucket += 1;
    } else {
      summary.forwardBucket += 1;
    }
  }

  return summary;
}

async function batchGetPlayers(client, tableName, keys) {
  const response = await client.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName]: {
          Keys: keys,
        },
      },
    }),
  );

  return response.Responses?.[tableName] ?? [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = args['--env'];
  const dryRun = args['--dry-run'] === 'true';
  const count = Number(args['--count'] ?? DEFAULT_COUNT);

  if (!ALLOWED_ENVS.has(env)) {
    throw new Error(`Synthetic seeding is limited to non-prod environments. Received "${env ?? ''}".`);
  }

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Count must be a positive integer. Received "${args['--count'] ?? ''}".`);
  }

  if (count !== DEFAULT_COUNT) {
    throw new Error(`This seed set is intentionally fixed at ${DEFAULT_COUNT} players. Received ${count}.`);
  }

  const tableName = `golden-bears-player-portal-data-${env}`;
  if (!tableName.endsWith(`-${env}`) || tableName.includes('-prod')) {
    throw new Error(`Refusing to seed table "${tableName}".`);
  }

  const generatedAt = new Date().toISOString();
  const players = Array.from({ length: count }, (_, index) =>
    buildProfile(index, env, generatedAt),
  );
  const summary = buildSummary(players);

  if (summary.totalPlayers !== DEFAULT_COUNT) {
    throw new Error(`Expected ${DEFAULT_COUNT} players but generated ${summary.totalPlayers}.`);
  }

  if (summary.goalieBucket !== GOALIE_COUNT) {
    throw new Error(`Expected ${GOALIE_COUNT} goalies but generated ${summary.goalieBucket}.`);
  }

  if (summary.defenseBucket !== DEFENSE_COUNT) {
    throw new Error(`Expected ${DEFENSE_COUNT} defensemen but generated ${summary.defenseBucket}.`);
  }

  if (summary.forwardBucket !== FORWARD_COUNT) {
    throw new Error(`Expected ${FORWARD_COUNT} forwards but generated ${summary.forwardBucket}.`);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          env,
          dryRun: true,
          tableName,
          summary,
          samplePlayers: players.slice(0, 4).map((player) => ({
            playerId: player.playerId,
            playerName: player.profile.playerName,
            birthYear: player.profile.birthYear,
            primaryPosition: player.profile.primaryPosition,
            handedness: player.profile.handedness,
            currentTeam: player.profile.currentTeam,
            latestHeightFeet: player.profile.latestHeightFeet,
            latestHeightInches: player.profile.latestHeightInches,
            latestWeightPounds: player.profile.latestWeightPounds,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  for (const player of players) {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: player,
      }),
    );
  }

  const verifiedItems = await batchGetPlayers(
    client,
    tableName,
    players.map((player) => ({ pk: player.pk, sk: player.sk })),
  );

  if (verifiedItems.length !== players.length) {
    throw new Error(
      `Verification failed for ${env}. Expected ${players.length} players but read back ${verifiedItems.length}.`,
    );
  }

  const verifiedSummary = buildSummary(verifiedItems);
  if (
    verifiedSummary.totalPlayers !== DEFAULT_COUNT ||
    verifiedSummary.goalieBucket !== GOALIE_COUNT ||
    verifiedSummary.defenseBucket !== DEFENSE_COUNT ||
    verifiedSummary.forwardBucket !== FORWARD_COUNT
  ) {
    throw new Error(`Verification summary mismatch for ${env}.`);
  }

  console.log(
    JSON.stringify(
      {
        env,
        region: REGION,
        tableName,
        seededCount: players.length,
        verifiedSummary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
