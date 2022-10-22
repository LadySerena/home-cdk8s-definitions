import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { Helm } from "cdk8s";
import { ClusterIssuer } from "../imports/cert-manager.io";
import { KubeNamespace } from "../imports/k8s";

export interface CertManagerProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace: KubeNamespace;
  readonly version: string;
  readonly projectID: string;
  readonly serviceAccountSecret: string;
  readonly serviceAccountSecretKey: string;
}

export class CertManager extends Construct {
  stagingIssuer: ClusterIssuer;
  productionIssuer: ClusterIssuer;

  constructor(scope: Construct, id: string, props: CertManagerProps) {
    super(scope, id);

    const standardLabels = StandardLabels("cert-server");
    const version = props.version;
    const labels = props.labels || standardLabels;
    const namespace = props.namespace;
    const projectID = props.projectID;
    const serviceAccountSecret = props.serviceAccountSecret;
    const serviceAccountSecretKey = props.serviceAccountSecretKey;

    labels["app.kubernetes.io/version"] = version;

    this.stagingIssuer = new ClusterIssuer(this, "lets-encrypt-staging", {
      metadata: {
        name: "lets-encrypt-staging",
        namespace: namespace.name,
        labels: labels,
      },
      spec: {
        acme: {
          email: "serena.tiede@gmail.com",
          server: "https://acme-staging-v02.api.letsencrypt.org/directory",
          privateKeySecretRef: {
            name: "letsencrypt-staging-key",
          },
          solvers: [
            {
              dns01: {
                cloudDns: {
                  project: projectID,
                  serviceAccountSecretRef: {
                    name: serviceAccountSecret,
                    key: serviceAccountSecretKey,
                  },
                },
              },
            },
          ],
        },
      },
    });

    this.productionIssuer = new ClusterIssuer(this, "lets-encrypt-production", {
      metadata: {
        name: "lets-encrypt-production",
        namespace: namespace.name,
        labels: labels,
      },
      spec: {
        acme: {
          email: "serena.tiede@gmail.com",
          server: "https://acme-v02.api.letsencrypt.org/directory",
          privateKeySecretRef: {
            name: "letsencrypt-production-key",
          },
          solvers: [
            {
              dns01: {
                cloudDns: {
                  project: projectID,
                  serviceAccountSecretRef: {
                    name: serviceAccountSecret,
                    key: serviceAccountSecretKey,
                  },
                },
              },
            },
          ],
        },
      },
    });

    new Helm(this, "cert-manager", {
      chart: "jetstack/cert-manager",
      helmFlags: ["--namespace", namespace.name, "--version", version],
      values: {
        global: {
          commonLabels: labels,
        },
      },
    });
  }
}
