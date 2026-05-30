const cors = require('cors');

/** Firebase callable CORS — allow any origin (localhost + production). */
const CALLABLE_CORS = true;

/** HTTP webhook wrapper. */
const corsAllowAll = cors({ origin: true });

module.exports = { CALLABLE_CORS, corsAllowAll };
