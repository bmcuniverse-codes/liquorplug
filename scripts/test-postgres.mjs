import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/store.test.mjs'],{stdio:'inherit',env:{...process.env,LP_TEST_POSTGRES:'1'}});
process.exit(result.status??1);
