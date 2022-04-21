import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { Prometheus } from "../imports/monitoring.coreos.com";
import { KubeNamespace } from "../imports/k8s";

export interface MonitoringProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class Monitoring extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const standardLabels = StandardLabels("prometheus");

    const name = props.name || "prometheus";
    const labels = props.labels || standardLabels;
    const namespace = props.namespace || "monitoring";

    const monitoringLabels = Object.assign({}, labels, {
      "monitoring.serenacodes.com/service-monitor-opt-in": "true",
      "monitoring.serenacodes.com/rule-opt-in": "true",
    });

    new KubeNamespace(this, "prometheus-ns", {
      metadata: {
        name: namespace,
        labels: monitoringLabels,
      },
    });

    new Prometheus(this, "prometheus", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        serviceMonitorSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/service-monitor-opt-in": "true",
          },
        },
        serviceMonitorNamespaceSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/service-monitor-opt-in": "true",
          },
        },
        version: "v2.33.5",
        replicas: 1,
        retention: "2h",
        walCompression: true,
        ruleSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/rule-opt-in": "true",
          },
        },
        ruleNamespaceSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/rule-opt-in": "true",
          },
        },
        additionalScrapeConfigs: {},
      },
    });
  }
}
