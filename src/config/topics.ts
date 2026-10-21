/**
 * Topic categories for the "Explore by topic" page. Categorisation logic: a repository
 * belongs to a category when it carries one of the category's GitHub topic tags
 * (maintainer-assigned metadata). RepoAtlas does not infer categories from code.
 */
export interface TopicCategory {
  slug: string;
  name: string;
  description: string;
  /** GitHub topic tags representing this category; the first one is primary. */
  topics: string[];
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  { slug: "artificial-intelligence", name: "Artificial Intelligence", description: "AI systems, agents and applied AI.", topics: ["artificial-intelligence", "ai", "ai-agents", "llm", "agents"] },
  { slug: "machine-learning", name: "Machine Learning", description: "Model training, ML libraries and MLOps.", topics: ["machine-learning", "deep-learning", "pytorch", "tensorflow", "mlops"] },
  { slug: "web-development", name: "Web Development", description: "Frameworks and tooling for the web.", topics: ["web", "webdev", "web-development", "nextjs", "web-framework"] },
  { slug: "frontend", name: "Frontend", description: "UI libraries, design systems and browser tooling.", topics: ["frontend", "react", "vue", "svelte", "css"] },
  { slug: "backend", name: "Backend", description: "Servers, APIs and backend frameworks.", topics: ["backend", "api", "rest-api", "graphql", "microservices"] },
  { slug: "mobile", name: "Mobile Development", description: "iOS, Android and cross-platform apps.", topics: ["mobile", "android", "ios", "flutter", "react-native"] },
  { slug: "devops", name: "DevOps", description: "CI/CD, infrastructure as code and operations.", topics: ["devops", "ci-cd", "infrastructure-as-code", "terraform", "ansible"] },
  { slug: "cloud", name: "Cloud Computing", description: "Cloud-native platforms, containers and orchestration.", topics: ["cloud", "kubernetes", "docker", "serverless", "cloud-native"] },
  { slug: "security", name: "Cybersecurity", description: "Security tooling, research and hardening.", topics: ["security", "cybersecurity", "penetration-testing", "infosec", "vulnerability-scanner"] },
  { slug: "databases", name: "Databases", description: "Database engines, ORMs and query tools.", topics: ["database", "sql", "postgresql", "nosql", "orm"] },
  { slug: "data-engineering", name: "Data Engineering", description: "Pipelines, streaming and analytics infrastructure.", topics: ["data-engineering", "etl", "data-pipeline", "apache-spark", "streaming"] },
  { slug: "developer-tools", name: "Developer Tools", description: "CLIs, editors, linters and productivity tools.", topics: ["developer-tools", "cli", "devtools", "terminal", "productivity"] },
  { slug: "open-source", name: "Open Source", description: "Projects about open source itself: guides, community, alternatives.", topics: ["open-source", "opensource", "hacktoberfest", "open-source-alternative", "self-hosted"] },
  { slug: "blockchain", name: "Blockchain", description: "Distributed ledgers, smart contracts and web3.", topics: ["blockchain", "ethereum", "smart-contracts", "web3", "solidity"] },
  { slug: "game-development", name: "Game Development", description: "Game engines, frameworks and tools.", topics: ["game-development", "gamedev", "game-engine", "unity", "godot"] },
  { slug: "automation", name: "Automation", description: "Workflow automation, bots and scripting.", topics: ["automation", "workflow-automation", "bot", "rpa", "scraping"] },
  { slug: "computer-vision", name: "Computer Vision", description: "Image and video understanding.", topics: ["computer-vision", "image-processing", "object-detection", "opencv", "image-segmentation"] },
  { slug: "nlp", name: "Natural Language Processing", description: "Language models, text processing and speech.", topics: ["nlp", "natural-language-processing", "transformers", "text-classification", "speech-recognition"] },
];

export function findCategory(slug: string) {
  return TOPIC_CATEGORIES.find((c) => c.slug === slug);
}

/** Categories whose topic list contains the given topic (for "related" links). */
export function categoriesForTopic(topic: string) {
  return TOPIC_CATEGORIES.filter((c) => c.topics.includes(topic));
}
