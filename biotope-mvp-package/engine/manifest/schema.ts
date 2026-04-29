import { z } from 'zod';

/**
 * Scenario manifest schema, version 1.
 *
 * The contract is `docs/biotope-mvp-planning.md` §2. Per §5: changes within
 * version 1 are additive-only — parsers tolerate unknown fields. Anything
 * removing or repurposing a field requires a manifest_version bump.
 *
 * Type inference: `Manifest = z.infer<typeof manifestSchema>`. Use that
 * inferred type everywhere; do not hand-write the matching TS type.
 */

// ─── enums ───────────────────────────────────────────────────────────────

export const ageRungSchema = z.enum(['5-6', '7-8', '9-10', '11-12']);
export type AgeRung = z.infer<typeof ageRungSchema>;

export const modeSchema = z.enum(['mentor_apprentice', 'solo']);
export type Mode = z.infer<typeof modeSchema>;

export const readingLevelSchema = z.enum([
  'pre_reader',
  'early_reader',
  'fluent_simple',
  'fluent',
]);
export type ReadingLevel = z.infer<typeof readingLevelSchema>;

export const hardwareUsageSchema = z.enum([
  'required',
  'required_for_field',
  'optional',
  'unused',
]);
export type HardwareUsage = z.infer<typeof hardwareUsageSchema>;

export const seasonSchema = z.enum(['spring', 'summer', 'fall', 'winter']);
export type Season = z.infer<typeof seasonSchema>;

export const daypartSchema = z.enum([
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'dusk',
  'night',
]);
export type Daypart = z.infer<typeof daypartSchema>;

export const weatherSchema = z.enum([
  'heavy_rain',
  'thunderstorm',
  'lightning',
  'extreme_heat',
  'extreme_cold',
  'snow',
  'high_wind',
]);
export type Weather = z.infer<typeof weatherSchema>;

export const phaseSchema = z.enum([
  'brief',
  'sim_episode',
  'field_activity',
  're_encoding',
  'reflection',
]);
export type Phase = z.infer<typeof phaseSchema>;

// ─── helpers ─────────────────────────────────────────────────────────────

/** A record keyed by age rung. */
function rungRecord<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    '5-6': value.optional(),
    '7-8': value.optional(),
    '9-10': value.optional(),
    '11-12': value.optional(),
  });
}

/**
 * Skill-rung overrides: the runtime interprets the patch keys per phase. We
 * intentionally don't constrain the shape — overrides include both base-field
 * patches (e.g. `duration_seconds_target`) AND runtime-resolved flags
 * (e.g. `add_call_recognition`) that are not in the base shape.
 */
const skillRungOverridesSchema = z
  .record(ageRungSchema, z.record(z.string(), z.unknown()))
  .optional();

// ─── identity ────────────────────────────────────────────────────────────

const authorSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
});

const identitySchema = {
  manifest_version: z.literal(1),
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'id must be a lowercase slug'),
  title: z.string().min(1),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:[-+].+)?$/, 'version must be SemVer'),
  authors: z.array(authorSchema).min(1),
  license: z.string().min(1),
  language_default: z.string().min(2),
  languages_available: z.array(z.string().min(2)).min(1),
};

// ─── audience ────────────────────────────────────────────────────────────

const audienceSchema = z.object({
  age_rungs: z.array(ageRungSchema).min(1),
  default_rung: ageRungSchema,
  modes: z.array(modeSchema).min(1),
  reading_level: rungRecord(readingLevelSchema),
});

// ─── locality & timing ──────────────────────────────────────────────────

const localitySchema = z.object({
  biome_any: z.boolean(),
  biome_preferred: z.array(z.string()).default([]),
  season_any: z.boolean(),
  season_preferred: z.array(seasonSchema).default([]),
  daypart: z.array(daypartSchema).default([]),
  weather_unsuitable: z.array(weatherSchema).default([]),
});

const estimatedMinutesSchema = rungRecord(z.number().positive());

// ─── hardware & permissions ─────────────────────────────────────────────

const hardwareSchema = z.object({
  camera: hardwareUsageSchema,
  microphone: hardwareUsageSchema,
  gps: hardwareUsageSchema,
  accelerometer: hardwareUsageSchema,
});

const permissionsExplainerSchema = z.record(z.string(), z.string());

// ─── content references ─────────────────────────────────────────────────

const contentSchema = z.object({
  species_pack: z.string().min(1),
  region_pack: z.string().min(1),
  narrative: z.string().min(1),
});

// ─── loop phases ────────────────────────────────────────────────────────

const briefSchema = z
  .object({
    duration_seconds_target: z.number().positive(),
    narrative_node: z.string().min(1),
    voice_over: z.boolean(),
    skill_rung_overrides: skillRungOverridesSchema,
  })
  .strict();

const simInteractionSchema = z
  .object({
    id: z.string().min(1),
    targets_from_species: z.array(z.string()).min(1),
    per_target_max_seconds: z.number().positive(),
    on_complete: z.string().min(1),
  })
  .strict();

const simEpisodeSchema = z
  .object({
    type: z.enum(['3d_scene']),
    scene: z.string().min(1),
    duration_seconds_target: z.number().positive(),
    interactions: z.array(simInteractionSchema).min(1),
    skill_rung_overrides: skillRungOverridesSchema,
  })
  .strict();

const speciesRecognitionSchema = z
  .object({
    attempt: z.boolean(),
    require_correct: z.boolean(),
  })
  .strict();

const fieldCompletionSchema = z
  .object({
    requires_photo: z.boolean(),
    photo_subject_hint: z.string().min(1),
    offline_capable: z.boolean(),
    species_recognition: speciesRecognitionSchema,
  })
  .strict();

const fieldSafetySchema = z
  .object({
    adult_present_required: rungRecord(z.boolean()),
    max_distance_from_origin_m: rungRecord(z.number().nonnegative()),
    time_limit_minutes: z.number().positive(),
  })
  .strict();

const fieldActivitySchema = z
  .object({
    type: z.enum(['photo_observation']),
    duration_minutes_target: z.number().positive(),
    instruction_node: z.string().min(1),
    completion: fieldCompletionSchema,
    safety: fieldSafetySchema,
    fallback_indoor: z
      .object({
        narrative_node: z.string().min(1),
      })
      .strict(),
    skill_rung_overrides: skillRungOverridesSchema,
  })
  .strict();

const acceptInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('photo'),
      subject: z.string().min(1),
      confidence_min: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('self_reported_id'),
      from_species_pack: z.boolean(),
    })
    .strict(),
]);

const reEncodingSchema = z
  .object({
    accept: z.array(acceptInputSchema).min(1),
    sim_response: z
      .object({
        action: z.string().min(1),
        narrative_node: z.string().min(1),
        on_no_observation: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const reflectionPromptSchema = z
  .object({
    kind: z.string().min(1),
    rungs: z.array(ageRungSchema).optional(),
  })
  .strict();

const reflectionSchema = z
  .object({
    duration_seconds_target: z.number().positive(),
    narrative_node: z.string().min(1),
    prompts: z.array(reflectionPromptSchema).min(1),
    unlocks: z
      .object({
        next_scenario: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const loopSchema = z
  .object({
    brief: briefSchema,
    sim_episode: simEpisodeSchema,
    field_activity: fieldActivitySchema,
    re_encoding: reEncodingSchema,
    reflection: reflectionSchema,
  })
  .strict();

// ─── seat configuration ─────────────────────────────────────────────────

const mentorApprenticeSchema = z
  .object({
    parent_seat: z
      .object({
        overlay_during: z.array(phaseSchema),
        can_pause: z.boolean(),
        can_explain: z.boolean(),
        coaching_prompts: z.record(phaseSchema, z.string()),
        photo_gate: z.boolean(),
      })
      .strict(),
    child_seat: z
      .object({
        can_solo_during: z.array(phaseSchema),
      })
      .strict(),
  })
  .strict();

// ─── privacy & safeguarding ─────────────────────────────────────────────

const privacySchema = z
  .object({
    photo_storage: z.enum(['local_only_default', 'local_only_strict', 'with_parent_share']),
    voice_input: z.enum(['off_by_default', 'on_by_default', 'disabled']),
    location_obscure: z.boolean(),
    share_button_visible: rungRecord(z.union([z.boolean(), z.literal('with_parent_confirm')])),
  })
  .strict();

// ─── assets ─────────────────────────────────────────────────────────────

const assetBundleSchema = z
  .object({
    path: z.string().min(1),
    size_kb: z.number().positive(),
  })
  .strict();

const assetsSchema = z
  .object({
    total_size_max_mb: z.number().positive(),
    bundles: z.array(assetBundleSchema).min(1),
  })
  .strict();

// ─── top-level manifest ─────────────────────────────────────────────────

export const manifestSchema = z
  .object({
    ...identitySchema,
    audience: audienceSchema,
    locality: localitySchema,
    estimated_minutes: estimatedMinutesSchema,
    hardware: hardwareSchema,
    permissions_explainer: permissionsExplainerSchema,
    content: contentSchema,
    loop: loopSchema,
    mentor_apprentice: mentorApprenticeSchema.optional(),
    privacy: privacySchema,
    assets: assetsSchema,
  })
  .strict()
  .superRefine((m, ctx) => {
    if (!m.audience.age_rungs.includes(m.audience.default_rung)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audience', 'default_rung'],
        message: `default_rung "${m.audience.default_rung}" is not in audience.age_rungs`,
      });
    }
    if (!m.languages_available.includes(m.language_default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['language_default'],
        message: `language_default "${m.language_default}" is not in languages_available`,
      });
    }
    if (m.audience.modes.includes('mentor_apprentice') && !m.mentor_apprentice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mentor_apprentice'],
        message: 'mentor_apprentice block is required when audience.modes includes "mentor_apprentice"',
      });
    }
  });

export type Manifest = z.infer<typeof manifestSchema>;

/**
 * Canonical key order for stringification. Matches the order in
 * `docs/biotope-mvp-planning.md` §2 so authored manifests that follow the
 * doc's example layout round-trip byte-stable through the loader.
 */
export const CANONICAL_KEY_ORDER: readonly string[] = [
  'manifest_version',
  'id',
  'title',
  'version',
  'authors',
  'license',
  'language_default',
  'languages_available',
  'audience',
  'locality',
  'estimated_minutes',
  'hardware',
  'permissions_explainer',
  'content',
  'loop',
  'mentor_apprentice',
  'privacy',
  'assets',
];
