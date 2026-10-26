export const RESOURCE_PAGE_SIZE = 25

export type ResourceKey = 'prompt-chains' | 'prompt-chain-steps' | 'generation-requests' | 'llm-responses'
export type ResourceSearchParams = Promise<Record<string, string | string[] | undefined>>
export type ResourceRecord = { id: string; [key: string]: unknown }

export interface ResourceField {
  key: string
  label: string
  format?: 'date' | 'boolean' | 'status' | 'json' | 'code'
  link?: { resource: ResourceKey; idKey: string }
  wide?: boolean
}

interface ResourceDefinition {
  table: string
  title: string
  singular: string
  description: string
  emptyDescription: string
  listSelect: string
  detailSelect: string
  order: { column: string; ascending: boolean }[]
  columns: ResourceField[]
  details: ResourceField[]
  filter?: { parameter: string; column: string; label: string; resource: ResourceKey }
  children?: { resource: ResourceKey; parameter: string; label: string }
}

const timestamps: ResourceField[] = [
  { key: 'created_at', label: 'Created (UTC)', format: 'date' },
  { key: 'updated_at', label: 'Updated (UTC)', format: 'date' },
]
const chainField: ResourceField = {
  key: 'chain.name', label: 'Prompt chain',
  link: { resource: 'prompt-chains', idKey: 'prompt_chain_id' },
}
const requestField: ResourceField = {
  key: 'generation_request_id', label: 'Request', format: 'code',
  link: { resource: 'generation-requests', idKey: 'generation_request_id' },
}

export const readResources: Record<ResourceKey, ResourceDefinition> = {
  'prompt-chains': {
    table: 'prompt_chains', title: 'Prompt chains', singular: 'Prompt chain',
    description: 'Inspect caption-generation chains and follow their steps in execution order.',
    emptyDescription: 'No prompt chains have been configured.',
    listSelect: 'id, name, slug, is_active, created_at',
    detailSelect: 'id, name, slug, description, is_active, created_at, updated_at',
    order: [{ column: 'created_at', ascending: false }, { column: 'id', ascending: false }],
    columns: [
      { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' },
      { key: 'is_active', label: 'Active', format: 'boolean' }, timestamps[0],
    ],
    details: [
      { key: 'id', label: 'Chain ID', format: 'code' },
      { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' },
      { key: 'is_active', label: 'Active', format: 'boolean' },
      { key: 'description', label: 'Description', wide: true }, ...timestamps,
    ],
    children: { resource: 'prompt-chain-steps', parameter: 'chainId', label: 'View ordered steps' },
  },
  'prompt-chain-steps': {
    table: 'prompt_chain_steps', title: 'Prompt chain steps', singular: 'Prompt chain step',
    description: 'Read prompts, model choices, and input settings. Steps are grouped by chain and ordered by position.',
    emptyDescription: 'No steps have been configured.',
    listSelect: 'id, name, prompt_chain_id, position, chain:prompt_chains(name), model:llm_models(name, model_identifier)',
    detailSelect: 'id, name, prompt_chain_id, position, llm_model_id, prompt_template, include_image, use_community_examples, use_curated_examples, use_terms, include_user_context, created_at, updated_at, chain:prompt_chains(name), model:llm_models(name, model_identifier, provider:llm_providers(name))',
    order: [{ column: 'prompt_chain_id', ascending: true }, { column: 'position', ascending: true }, { column: 'id', ascending: true }],
    columns: [
      { key: 'name', label: 'Step' }, chainField, { key: 'position', label: 'Position' },
      { key: 'model.name', label: 'Model' },
    ],
    details: [
      { key: 'id', label: 'Step ID', format: 'code' }, { key: 'name', label: 'Name' },
      chainField, { key: 'position', label: 'Position' },
      { key: 'model.name', label: 'Model' }, { key: 'model.model_identifier', label: 'Model identifier', format: 'code' },
      { key: 'model.provider.name', label: 'Provider' },
      { key: 'include_image', label: 'Include image', format: 'boolean' },
      { key: 'use_community_examples', label: 'Use community examples', format: 'boolean' },
      { key: 'use_curated_examples', label: 'Use curated examples', format: 'boolean' },
      { key: 'use_terms', label: 'Use terms', format: 'boolean' },
      { key: 'include_user_context', label: 'Include user context', format: 'boolean' },
      { key: 'prompt_template', label: 'Prompt template', wide: true }, ...timestamps,
    ],
    filter: { parameter: 'chainId', column: 'prompt_chain_id', label: 'Chain ID', resource: 'prompt-chains' },
  },
  'generation-requests': {
    table: 'generation_requests', title: 'Generation requests', singular: 'Generation request',
    description: 'Inspect caption-generation attempts, their status, and the configuration used.',
    emptyDescription: 'No generation attempts have been recorded yet. Generate a new caption in the user-facing app to create a request. Older saved captions remain in AI Media.',
    listSelect: 'id, user_id, status, prompt_chain_id, created_at, chain:prompt_chains(name)',
    detailSelect: 'id, user_id, image_id, prompt_chain_id, user_context, status, configuration_snapshot, error_message, started_at, completed_at, created_at, updated_at, chain:prompt_chains(name), image:images(storage_bucket, storage_path, original_filename, mime_type)',
    order: [{ column: 'created_at', ascending: false }, { column: 'id', ascending: false }],
    columns: [
      { key: 'id', label: 'Request', format: 'code' },
      { key: 'status', label: 'Status', format: 'status' }, chainField,
      { key: 'user_id', label: 'User ID', format: 'code' }, timestamps[0],
    ],
    details: [
      { key: 'id', label: 'Request ID', format: 'code' }, { key: 'status', label: 'Status', format: 'status' },
      { key: 'user_id', label: 'User ID', format: 'code' }, chainField,
      { key: 'image_id', label: 'Image ID', format: 'code' },
      { key: 'image.original_filename', label: 'Image filename' },
      { key: 'image.storage_bucket', label: 'Storage bucket' },
      { key: 'image.storage_path', label: 'Storage path', format: 'code' },
      { key: 'image.mime_type', label: 'Image type' },
      { key: 'user_context', label: 'User context', wide: true },
      { key: 'error_message', label: 'Error message', wide: true },
      { key: 'started_at', label: 'Started (UTC)', format: 'date' },
      { key: 'completed_at', label: 'Completed (UTC)', format: 'date' }, ...timestamps,
      { key: 'configuration_snapshot', label: 'Configuration at generation time', format: 'json', wide: true },
    ],
    children: { resource: 'llm-responses', parameter: 'requestId', label: 'View responses and retry attempts' },
  },
  'llm-responses': {
    table: 'llm_responses', title: 'LLM responses', singular: 'LLM response',
    description: 'Read model output, prompts, failures, and usage for each provider call.',
    emptyDescription: 'No Gemini calls have been recorded yet. Generate a new caption in the user-facing app to see its response and retry attempts. Historical responses have not been backfilled.',
    listSelect: 'id, generation_request_id, step_position, attempt, status, model_identifier, created_at',
    detailSelect: 'id, generation_request_id, prompt_chain_step_id, llm_model_id, step_position, attempt, provider_slug, model_identifier, prompt_text, response_text, status, http_status, error_message, input_tokens, output_tokens, latency_ms, response_metadata, created_at',
    order: [{ column: 'created_at', ascending: false }, { column: 'id', ascending: false }],
    columns: [
      { key: 'id', label: 'Response', format: 'code' }, requestField,
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'model_identifier', label: 'Model' },
      { key: 'step_position', label: 'Step' }, { key: 'attempt', label: 'Attempt' }, timestamps[0],
    ],
    details: [
      { key: 'id', label: 'Response ID', format: 'code' }, requestField,
      { key: 'prompt_chain_step_id', label: 'Chain step', format: 'code', link: { resource: 'prompt-chain-steps', idKey: 'prompt_chain_step_id' } },
      { key: 'status', label: 'Status', format: 'status' },
      { key: 'step_position', label: 'Step position' }, { key: 'attempt', label: 'Attempt' },
      { key: 'provider_slug', label: 'Provider at generation time' },
      { key: 'model_identifier', label: 'Model at generation time', format: 'code' },
      { key: 'http_status', label: 'HTTP status' },
      { key: 'input_tokens', label: 'Input tokens' }, { key: 'output_tokens', label: 'Output tokens' },
      { key: 'latency_ms', label: 'Latency (ms)' }, timestamps[0],
      { key: 'prompt_text', label: 'Prompt sent to model', wide: true },
      { key: 'response_text', label: 'Model response', wide: true },
      { key: 'error_message', label: 'Error message', wide: true },
      { key: 'response_metadata', label: 'Response metadata', format: 'json', wide: true },
    ],
    filter: { parameter: 'requestId', column: 'generation_request_id', label: 'Request ID', resource: 'generation-requests' },
  },
}

export function isResourceId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function resourcePage(value: string | string[] | undefined): number {
  const page = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : 1
  const maximumPage = Math.floor((2_147_483_647 - RESOURCE_PAGE_SIZE) / RESOURCE_PAGE_SIZE) + 1
  return Number.isSafeInteger(page) && page <= maximumPage ? page : 1
}

export function resourceValue(row: ResourceRecord, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)[part]
      : undefined
  ), row)
}
