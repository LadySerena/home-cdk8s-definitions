import { Construct } from "constructs";
import { Helm } from "cdk8s";
import { KubeNamespace } from "../imports/k8s";
import { StandardLabels } from "./standardLabels";

export interface StorageProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class StorageProvider extends Construct {
  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const name = props.name || "longhorn";
    const namespace = props.namespace || "longhorn-system";

    new KubeNamespace(this, "namespace", {
      metadata: {
        name: namespace,
        labels: StandardLabels(name),
      },
    });

    new Helm(this, "longhorn", {
      chart: "longhorn/longhorn",
      helmFlags: [`--namespace=${namespace}`],
      values: {
        enablePSP: false,
      },
    });

  }
}
