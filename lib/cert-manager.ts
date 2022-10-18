import { Construct } from "constructs";
import { KubeNamespace } from "../imports/k8s";
import { StandardLabels } from "./standardLabels";
import { Helm } from "cdk8s";

export interface CertManagerProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
  readonly version: string;
}

export class CertManager extends Construct {
  constructor(scope: Construct, id: string, props: CertManagerProps) {
    super(scope, id);

    const standardLabels = StandardLabels("cert-server");
    const version = props.version;
    const labels = props.labels || standardLabels;
    const namespace = props.namespace || "cert-manager";

    labels["app.kubernetes.io/version"] = version;

    const ns = new KubeNamespace(this, "namespace", {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    new Helm(this, "cert-manager", {
      chart: "jetstack/cert-manager",
      helmFlags: ["--namespace", ns.name, "--version", version],
      values: {
        global: {
          commonLabels: labels,
        },
      },
    });
  }
}
