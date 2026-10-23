// Download + categorize in one command: npm run sync
import { runPipeline } from "./pipeline.js";

runPipeline((e) => {
  if (e.type === "log") console.log(e.line);
  if (e.type === "step") console.log(`\n>> ${e.id} : ${e.status}${e.detail ? ` (${e.detail})` : ""}`);
})
  .then((json) => {
    console.log(`\n✅ Données prêtes : ${json}`);
    console.log("   Affichez-les avec : npm run dashboard");
  })
  .catch((err) => {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  });
