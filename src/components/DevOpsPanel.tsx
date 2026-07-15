import { useEffect, useState } from "react";
import { useT } from "../i18n";

interface Props {
  root: string;
  onClose: () => void;
  runInTerminal: (cmd: string) => void;
  onNotice: (msg: string) => void;
}

interface Detection {
  dockerfile: boolean;
  dockerignore: boolean;
  compose: string | null;
  terraform: boolean;
  k8sDir: string | null;
  workflows: string[];
  hasPackageJson: boolean;
  hasPython: boolean;
  hasGitignore: boolean;
}

const TOOLS = [
  { id: "docker", name: "Docker", url: "https://www.docker.com/products/docker-desktop/" },
  { id: "kubectl", name: "kubectl", url: "https://kubernetes.io/docs/tasks/tools/" },
  { id: "terraform", name: "Terraform", url: "https://developer.hashicorp.com/terraform/install" },
  { id: "gh", name: "GitHub CLI", url: "https://cli.github.com/" },
] as const;

// ---------- plantillas ----------

const DOCKERFILE_NODE_TEMPLATE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "start"]
`;

const DOCKERFILE_PY_TEMPLATE = `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# ajusta el comando a tu app: uvicorn para FastAPI, python main.py, etc.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;

const DOCKERIGNORE_TEMPLATE = `node_modules
dist
build
.git
.env
*.log
__pycache__
.venv
venv
`;

const composeTemplate = (name: string) => `services:
  app:
    build: .
    image: ${name}
    ports:
      - "3000:3000"
    restart: unless-stopped
    # env_file: .env
`;

const k8sTemplate = (name: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${name}:latest
          ports:
            - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  selector:
    app: ${name}
  ports:
    - port: 80
      targetPort: 3000
`;

const TF_TEMPLATE = `terraform {
  required_version = ">= 1.5"

  # declara aquí tus providers, por ejemplo:
  # required_providers {
  #   aws = {
  #     source  = "hashicorp/aws"
  #     version = "~> 5.0"
  #   }
  # }
}

# provider "aws" {
#   region = "us-east-1"
# }

# recurso de ejemplo:
# resource "aws_s3_bucket" "assets" {
#   bucket = "mi-bucket-unico"
# }
`;

const CI_NODE_TEMPLATE = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm run build --if-present
      - run: npm test --if-present
`;

const CI_PY_TEMPLATE = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
      - run: pip install -r requirements.txt
      - run: pip install pytest
      - run: pytest
`;

const RELEASE_TEMPLATE = `name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: softprops/action-gh-release@v2
        with:
          files: release/*/*Setup*.exe
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

const GITIGNORE_NODE_TEMPLATE = `node_modules/
dist/
build/
.env
.env.*
*.log
`;

const GITIGNORE_PY_TEMPLATE = `__pycache__/
*.pyc
.venv/
venv/
.env
dist/
*.egg-info/
`;

export default function DevOpsPanel({ root, onClose, runInTerminal, onNotice }: Props) {
  const { t } = useT();
  const [detect, setDetect] = useState<Detection | null>(null);
  const [tools, setTools] = useState<Record<string, boolean>>({});

  const projectName = (root.split(/[\\/]/).pop() ?? "app")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  useEffect(() => {
    void (async () => {
      const entries = await window.api.readDir(root);
      const names = entries.map((e) => e.name.toLowerCase());
      const compose =
        ["docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"].find(
          (c) => names.includes(c),
        ) ?? null;
      const k8sDir =
        entries.find(
          (e) => e.isDirectory && ["k8s", "kubernetes", "manifests"].includes(e.name.toLowerCase()),
        )?.name ?? null;
      let workflows: string[] = [];
      try {
        workflows = (await window.api.readDir(root + "\\.github\\workflows")).map(
          (e) => e.name,
        );
      } catch {
        /* no hay workflows */
      }
      setDetect({
        dockerfile: names.includes("dockerfile"),
        dockerignore: names.includes(".dockerignore"),
        compose,
        terraform: names.some((n) => n.endsWith(".tf")),
        k8sDir,
        workflows,
        hasPackageJson: names.includes("package.json"),
        hasPython:
          names.includes("requirements.txt") ||
          names.includes("pyproject.toml") ||
          names.some((n) => n.endsWith(".py")),
        hasGitignore: names.includes(".gitignore"),
      });

      const checks: Record<string, boolean> = {};
      for (const t of TOOLS) checks[t.id] = await window.api.checkTool(t.id);
      setTools(checks);
    })();
  }, [root]);

  function run(cmd: string) {
    runInTerminal(cmd);
    onClose();
  }

  async function generate(relPath: string, content: string, label: string) {
    const abs = root + "\\" + relPath;
    const created = await window.api.createFile(abs);
    if (!created) {
      onNotice(t("dv.exists", relPath));
      return;
    }
    await window.api.writeFile(abs, content);
    onNotice(t("dv.created", label, relPath));
    onClose();
  }

  if (!detect) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">DevOps</div>
          <div className="modal-body">{t("dv.analyzing")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal devops" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">DevOps · {projectName}</div>
        <div className="modal-body">
          {/* herramientas instaladas */}
          <div className="dv-tools">
            {TOOLS.map((tool) => (
              <span
                key={tool.id}
                className={`dv-tool ${tools[tool.id] ? "ok" : "missing"}`}
                title={
                  tools[tool.id]
                    ? `${tool.name} ${t("dv.installed")}`
                    : `${t("dv.download")} ${tool.name}`
                }
                onClick={() => {
                  if (!tools[tool.id]) void window.api.openExternal(tool.url);
                }}
              >
                {tools[tool.id] ? "●" : "○"} {tool.name}
                {!tools[tool.id] && " ↗"}
              </span>
            ))}
          </div>

          {/* Docker */}
          <div className="dv-section">
            <div className="dv-heading">
              Docker {detect.dockerfile ? t("dv.dockerDetected") : ""}
              {detect.compose ? ` · ${detect.compose}` : ""}
            </div>
            <div className="dv-actions">
              {detect.dockerfile && (
                <>
                  <button
                    className="dv-btn"
                    disabled={!tools.docker}
                    onClick={() => run(`docker build -t ${projectName} .`)}
                  >
                    ⚙ build
                  </button>
                  <button
                    className="dv-btn"
                    disabled={!tools.docker}
                    onClick={() => run(`docker run --rm -it -p 3000:3000 ${projectName}`)}
                  >
                    ▶ run
                  </button>
                </>
              )}
              {detect.compose && (
                <>
                  <button
                    className="dv-btn"
                    disabled={!tools.docker}
                    onClick={() => run("docker compose up -d")}
                  >
                    ▶ compose up
                  </button>
                  <button
                    className="dv-btn"
                    disabled={!tools.docker}
                    onClick={() => run("docker compose down")}
                  >
                    ■ compose down
                  </button>
                  <button
                    className="dv-btn"
                    disabled={!tools.docker}
                    onClick={() => run("docker compose logs -f")}
                  >
                    ≡ logs
                  </button>
                </>
              )}
              <button
                className="dv-btn"
                disabled={!tools.docker}
                onClick={() => run("docker ps")}
              >
                ps
              </button>
              <button
                className="dv-btn"
                disabled={!tools.docker}
                onClick={() => run("docker images")}
              >
                images
              </button>
              {!detect.dockerfile && detect.hasPackageJson && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate("Dockerfile", DOCKERFILE_NODE_TEMPLATE, "Dockerfile (Node)")
                  }
                >
                  {t("dv.gen")} Dockerfile (Node)
                </button>
              )}
              {!detect.dockerfile && detect.hasPython && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate("Dockerfile", DOCKERFILE_PY_TEMPLATE, "Dockerfile (Python)")
                  }
                >
                  {t("dv.gen")} Dockerfile (Python)
                </button>
              )}
              {detect.dockerfile && !detect.dockerignore && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(".dockerignore", DOCKERIGNORE_TEMPLATE, ".dockerignore")
                  }
                >
                  {t("dv.gen")} .dockerignore
                </button>
              )}
              {detect.dockerfile && !detect.compose && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(
                      "docker-compose.yml",
                      composeTemplate(projectName),
                      "docker-compose.yml",
                    )
                  }
                >
                  {t("dv.gen")} compose
                </button>
              )}
            </div>
          </div>

          {/* Kubernetes */}
          <div className="dv-section">
            <div className="dv-heading">
              Kubernetes
              {detect.k8sDir
                ? ` ${t("dv.k8sFolder")} ${detect.k8sDir}/`
                : ` ${t("dv.noManifests")}`}
            </div>
            <div className="dv-actions">
              {detect.k8sDir && (
                <>
                  <button
                    className="dv-btn"
                    disabled={!tools.kubectl}
                    onClick={() => run(`kubectl apply -f ${detect.k8sDir}/`)}
                  >
                    ▶ apply
                  </button>
                  <button
                    className="dv-btn"
                    disabled={!tools.kubectl}
                    onClick={() => run(`kubectl delete -f ${detect.k8sDir}/`)}
                  >
                    ■ delete
                  </button>
                </>
              )}
              <button
                className="dv-btn"
                disabled={!tools.kubectl}
                onClick={() => run("kubectl get pods")}
              >
                get pods
              </button>
              <button
                className="dv-btn"
                disabled={!tools.kubectl}
                onClick={() => run("kubectl get services")}
              >
                get services
              </button>
              <button
                className="dv-btn"
                disabled={!tools.kubectl}
                onClick={() => run("kubectl get deployments")}
              >
                get deployments
              </button>
              {!detect.k8sDir && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(
                      "k8s\\deployment.yaml",
                      k8sTemplate(projectName),
                      "Manifests de Kubernetes (Deployment + Service)",
                    )
                  }
                >
                  {t("dv.gen")} manifests (k8s/)
                </button>
              )}
            </div>
          </div>

          {/* Terraform */}
          <div className="dv-section">
            <div className="dv-heading">
              Terraform{" "}
              {detect.terraform ? t("dv.tfDetected") : t("dv.noTf")}
            </div>
            <div className="dv-actions">
              {detect.terraform ? (
                <>
                  <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform init")}>
                    init
                  </button>
                  <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform fmt")}>
                    fmt
                  </button>
                  <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform validate")}>
                    validate
                  </button>
                  <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform plan")}>
                    plan
                  </button>
                  <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform apply")}>
                    apply
                  </button>
                </>
              ) : (
                <button
                  className="dv-btn gen"
                  onClick={() => void generate("main.tf", TF_TEMPLATE, "main.tf")}
                >
                  {t("dv.gen")} main.tf
                </button>
              )}
            </div>
          </div>

          {/* CI/CD */}
          <div className="dv-section">
            <div className="dv-heading">
              CI/CD
              {detect.workflows.length
                ? ` · ${detect.workflows.length} workflow(s): ${detect.workflows.join(", ")}`
                : ` ${t("dv.noWorkflows")}`}
            </div>
            <div className="dv-actions">
              {!detect.workflows.includes("ci.yml") && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(
                      ".github\\workflows\\ci.yml",
                      detect.hasPackageJson ? CI_NODE_TEMPLATE : CI_PY_TEMPLATE,
                      `Workflow de CI (${detect.hasPackageJson ? "Node" : "Python"})`,
                    )
                  }
                >
                  {t("dv.gen")} CI ({detect.hasPackageJson ? "Node" : "Python"})
                </button>
              )}
              {!detect.workflows.includes("release.yml") && detect.hasPackageJson && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(
                      ".github\\workflows\\release.yml",
                      RELEASE_TEMPLATE,
                      "Workflow de release (.exe automático por tag)",
                    )
                  }
                >
                  {t("dv.gen")} Release (.exe)
                </button>
              )}
              <button
                className="dv-btn"
                disabled={!tools.gh}
                onClick={() => run("gh run list --limit 5")}
              >
                gh runs
              </button>
              <button
                className="dv-btn"
                disabled={!tools.gh}
                onClick={() => run("gh pr list")}
              >
                gh prs
              </button>
              <button
                className="dv-btn"
                disabled={!tools.gh}
                onClick={() => run("gh repo view --web")}
              >
                repo ↗
              </button>
            </div>
          </div>

          {/* proyecto */}
          {!detect.hasGitignore && (
            <div className="dv-section">
              <div className="dv-heading">{t("dv.noGitignore")}</div>
              <div className="dv-actions">
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(
                      ".gitignore",
                      detect.hasPackageJson ? GITIGNORE_NODE_TEMPLATE : GITIGNORE_PY_TEMPLATE,
                      ".gitignore",
                    )
                  }
                >
                  {t("dv.gen")} .gitignore ({detect.hasPackageJson ? "Node" : "Python"})
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            {t("dv.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
