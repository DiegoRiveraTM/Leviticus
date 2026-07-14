import { useEffect, useState } from "react";

interface Props {
  root: string;
  onClose: () => void;
  runInTerminal: (cmd: string) => void;
  onNotice: (msg: string) => void;
}

interface Detection {
  dockerfile: boolean;
  compose: string | null;
  terraform: boolean;
  k8sDir: string | null;
  workflows: string[];
  hasPackageJson: boolean;
}

const TOOLS = [
  { id: "docker", name: "Docker", url: "https://www.docker.com/products/docker-desktop/" },
  { id: "kubectl", name: "kubectl", url: "https://kubernetes.io/docs/tasks/tools/" },
  { id: "terraform", name: "Terraform", url: "https://developer.hashicorp.com/terraform/install" },
  { id: "gh", name: "GitHub CLI", url: "https://cli.github.com/" },
] as const;

const DOCKERFILE_TEMPLATE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present
EXPOSE 3000
CMD ["npm", "start"]
`;

const CI_TEMPLATE = `name: CI

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

export default function DevOpsPanel({ root, onClose, runInTerminal, onNotice }: Props) {
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
        compose,
        terraform: names.some((n) => n.endsWith(".tf")),
        k8sDir,
        workflows,
        hasPackageJson: names.includes("package.json"),
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
      onNotice(`${relPath} ya existe; no lo sobrescribí.`);
      return;
    }
    await window.api.writeFile(abs, content);
    onNotice(`✓ ${label} creado en ${relPath}`);
    onClose();
  }

  if (!detect) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">DevOps</div>
          <div className="modal-body">Analizando el proyecto…</div>
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
            {TOOLS.map((t) => (
              <span
                key={t.id}
                className={`dv-tool ${tools[t.id] ? "ok" : "missing"}`}
                title={tools[t.id] ? `${t.name} instalado` : `Descargar ${t.name}`}
                onClick={() => {
                  if (!tools[t.id]) void window.api.openExternal(t.url);
                }}
              >
                {tools[t.id] ? "●" : "○"} {t.name}
                {!tools[t.id] && " ↗"}
              </span>
            ))}
          </div>

          {/* Docker */}
          <div className="dv-section">
            <div className="dv-heading">
              Docker {detect.dockerfile ? "· Dockerfile detectado" : ""}
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
              {!detect.dockerfile && detect.hasPackageJson && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate("Dockerfile", DOCKERFILE_TEMPLATE, "Dockerfile (Node)")
                  }
                >
                  + Generar Dockerfile
                </button>
              )}
            </div>
          </div>

          {/* Terraform */}
          {detect.terraform && (
            <div className="dv-section">
              <div className="dv-heading">Terraform · archivos .tf detectados</div>
              <div className="dv-actions">
                <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform init")}>
                  init
                </button>
                <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform plan")}>
                  plan
                </button>
                <button className="dv-btn" disabled={!tools.terraform} onClick={() => run("terraform apply")}>
                  apply
                </button>
              </div>
            </div>
          )}

          {/* Kubernetes */}
          {detect.k8sDir && (
            <div className="dv-section">
              <div className="dv-heading">Kubernetes · carpeta {detect.k8sDir}/</div>
              <div className="dv-actions">
                <button
                  className="dv-btn"
                  disabled={!tools.kubectl}
                  onClick={() => run(`kubectl apply -f ${detect.k8sDir}/`)}
                >
                  apply
                </button>
                <button className="dv-btn" disabled={!tools.kubectl} onClick={() => run("kubectl get pods")}>
                  get pods
                </button>
              </div>
            </div>
          )}

          {/* CI/CD */}
          <div className="dv-section">
            <div className="dv-heading">
              CI/CD
              {detect.workflows.length
                ? ` · ${detect.workflows.length} workflow(s): ${detect.workflows.join(", ")}`
                : " · sin workflows"}
            </div>
            <div className="dv-actions">
              {!detect.workflows.includes("ci.yml") && (
                <button
                  className="dv-btn gen"
                  onClick={() =>
                    void generate(".github\\workflows\\ci.yml", CI_TEMPLATE, "Workflow de CI")
                  }
                >
                  + Generar CI (GitHub Actions)
                </button>
              )}
              {!detect.workflows.includes("release.yml") && (
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
                  + Generar Release (.exe por tag)
                </button>
              )}
              <button
                className="dv-btn"
                disabled={!tools.gh}
                onClick={() => run("gh run list --limit 5")}
              >
                gh runs
              </button>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
