import Ajv2020 from 'ajv/dist/2020';
import { JsonObjectSchema, type JsonObject } from '../contracts/common';

/** Compile the authoritative target input schema once; never fetch external schemas. */
export const compileTargetRenderModelValidator = (schema: JsonObject, documents: readonly JsonObject[] = []): ((model: unknown) => JsonObject) => {
  const ajv = new Ajv2020({ strict: false, allErrors: false, coerceTypes: false, useDefaults: false, removeAdditional: false });
  const registered = new Set<string>();
  for (const document of documents) {
    if (document !== schema && typeof document.$id === 'string' && document.$id !== schema.$id && !registered.has(document.$id)) {
      ajv.addSchema(document);
      registered.add(document.$id);
    }
  }
  const validate = ajv.compile(schema);
  return (input) => {
    const model = JsonObjectSchema.parse(input);
    if (!validate(model)) throw Object.assign(new TypeError('Target render model does not match its declared schema.'), { code: 'DECLARATIVE_TARGET_RENDER_MODEL_INVALID' });
    return model;
  };
};
