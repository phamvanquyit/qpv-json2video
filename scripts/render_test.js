/**
 * render_test.js — Render example configs for testing
 *
 * Usage:
 *   node scripts/render_test.js                    # List all examples
 *   node scripts/render_test.js 01                 # Render 01_basic_text.json
 *   node scripts/render_test.js filters            # Render first match containing "filters"
 *   node scripts/render_test.js all                # Render ALL examples
 *   node scripts/render_test.js 01 03 08           # Render multiple examples
 */

const { json2videoFile } = require("../dist/json2video");
const path = require("path");
const fs = require("fs");

const EXAMPLES_DIR = path.join(__dirname, "..", "examples");
const OUTPUT_DIR = path.join(__dirname, "output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all JSON example files, sorted
function getExamples() {
  return fs
    .readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

// Find matching examples by query (number prefix or partial name match)
function findExamples(query) {
  const all = getExamples();
  const matches = all.filter((f) => {
    const name = f.replace(".json", "").toLowerCase();
    const q = query.toLowerCase();
    // Match by number prefix (e.g. "01", "08")
    if (name.startsWith(q)) return true;
    // Match by partial name (e.g. "filters", "blend", "caption")
    if (name.includes(q)) return true;
    return false;
  });
  return matches;
}

// Pretty print example list
function listExamples() {
  const examples = getExamples();
  console.log("\n📂 Available examples:\n");
  examples.forEach((f, i) => {
    const name = f.replace(".json", "");
    console.log(`   ${name}`);
  });
  console.log(`\n   Total: ${examples.length} examples`);
  console.log("\n💡 Usage:");
  console.log(
    "   node scripts/render_test.js 01              # Render by number",
  );
  console.log(
    "   node scripts/render_test.js filters          # Search by name",
  );
  console.log("   node scripts/render_test.js 01 03 08         # Multiple");
  console.log("   node scripts/render_test.js all              # Render ALL\n");
}

// Render a single example
async function renderExample(filename) {
  const configPath = path.join(EXAMPLES_DIR, filename);
  const name = filename.replace(".json", "");
  const outputPath = path.join(OUTPUT_DIR, `${name}.mp4`);

  console.log(`\n🎬 Rendering: ${name}`);

  // Read and parse JSON config
  const configStr = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(configStr);

  // Calculate duration
  const totalDuration = config.tracks.reduce((max, t) => {
    const trackEnd =
      (t.start || 0) + t.scenes.reduce((s, sc) => s + sc.duration, 0);
    return Math.max(max, trackEnd);
  }, 0);

  console.log(
    `   ${config.width}x${config.height} @ ${config.fps || 30}fps • ${totalDuration}s • ${config.tracks.length} track(s)`,
  );

  const startTime = Date.now();

  const result = await json2videoFile(config, outputPath, {
    onProgress: (p) => {
      const bar =
        "█".repeat(Math.floor(p / 5)) + "░".repeat(20 - Math.floor(p / 5));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\r   [${bar}] ${p}% (${elapsed}s)`);
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   ✅ Done in ${elapsed}s → ${outputPath}`);

  return { name, elapsed, outputPath, success: true };
}

// Main
async function main() {
  const args = process.argv.slice(2);

  // No args = list examples
  if (args.length === 0) {
    listExamples();
    return;
  }

  // Collect files to render
  let filesToRender = [];

  if (args.length === 1 && args[0].toLowerCase() === "all") {
    filesToRender = getExamples();
  } else {
    for (const query of args) {
      const matches = findExamples(query);
      if (matches.length === 0) {
        console.error(`❌ No example found matching: "${query}"`);
        listExamples();
        process.exit(1);
      }
      filesToRender.push(...matches);
    }
    // Deduplicate
    filesToRender = [...new Set(filesToRender)];
  }

  console.log(`\n🎥 Will render ${filesToRender.length} example(s):`);
  filesToRender.forEach((f) => console.log(`   • ${f.replace(".json", "")}`));

  const results = [];
  const totalStart = Date.now();

  for (const file of filesToRender) {
    try {
      const result = await renderExample(file);
      results.push(result);
    } catch (err) {
      console.error(`\n   ❌ Failed: ${err.message}`);
      results.push({
        name: file.replace(".json", ""),
        success: false,
        error: err.message,
      });
    }
  }

  // Summary
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log("\n" + "=".repeat(60));
  console.log(
    `📊 Summary: ${succeeded}/${results.length} succeeded in ${totalElapsed}s`,
  );
  if (failed > 0) {
    console.log(
      `   ❌ Failed: ${results
        .filter((r) => !r.success)
        .map((r) => r.name)
        .join(", ")}`,
    );
  }
  console.log(`   📁 Output: ${OUTPUT_DIR}`);
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err.message);
  process.exit(1);
});
