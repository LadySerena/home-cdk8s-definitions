import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { PodMonitor, Prometheus } from "../imports/monitoring.coreos.com";
import { KubeNamespace, KubeRoleBinding, KubeServiceAccount } from "../imports/k8s";

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
      "monitoring.serenacodes.com/pod-monitor-opt-in": "true",
    });

    const prometheusServiceAccount = new KubeServiceAccount(this, "prometheus-service-account", {
      metadata: {
        name: "prometheus",
        namespace: namespace,
        labels: labels,
      },
    });

    new KubeRoleBinding(this, "prometheus-binding", {
      metadata: {
        name: "prometheus",
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        kind: "ClusterRole",
        name: "view",
        apiGroup: "rbac.authorization.k8s.io",
      },
      subjects: [
        {
          kind: prometheusServiceAccount.kind,
          name: prometheusServiceAccount.name,
          namespace: namespace,
          apiGroup: "",
        },
      ],
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
        serviceAccountName: prometheusServiceAccount.name,
        podMetadata: {
          labels: labels,
        },
        serviceMonitorSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/service-monitor-opt-in": "true",
          },
        },
        podMonitorSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/pod-monitor-opt-in": "true",
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
      },
    });

    new PodMonitor(this, "self-monitor", {
      metadata: {
        name: "self-monitor",
        namespace: namespace,
        labels: monitoringLabels,
      },
      spec: {
        podMetricsEndpoints: [
          {
            port: "web",
            path: "/metrics",
            scheme: "http",
          },
          {
            port: "reloader-web",
            path: "/metrics",
            scheme: "http",
          },
        ],
        selector: {
          matchLabels: labels,
        },
      },
    });
  }
}
