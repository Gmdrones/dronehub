import { DJILog } from './dist/decoder.mjs';
import { createHandler } from './handler.mjs';
export default { fetch: createHandler(DJILog) };
