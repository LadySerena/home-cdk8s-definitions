import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import {
  PodMonitor,
  PodMonitorSpecPodMetricsEndpointsMetricRelabelingsAction,
  Prometheus,
  PrometheusSpecStorageVolumeClaimTemplateSpecResourcesRequests,
} from "../imports/monitoring.coreos.com";
import {
  IntOrString,
  KubeClusterRoleBinding,
  KubeDaemonSet,
  KubeIngress,
  KubeNamespace,
  KubeService,
  KubeServiceAccount,
  KubeStorageClass,
  Quantity,
  Volume,
} from "../imports/k8s";

export interface MonitoringProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
  readonly storageClass?: KubeStorageClass;
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

    new KubeClusterRoleBinding(this, "prometheus-binding", {
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
        storage: {
          volumeClaimTemplate: {
            metadata: {
              name: "prometheus-storage",
              labels: labels,
            },
            spec: {
              storageClassName: "longhorn",
              accessModes: ["ReadWriteOnce"],
              resources: {
                requests: {
                  storage: PrometheusSpecStorageVolumeClaimTemplateSpecResourcesRequests.fromString("1Gi"),
                },
              },
            },
          },
        },
        securityContext: {
          fsGroup: 65534,
        },
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
        podMonitorNamespaceSelector: {
          matchLabels: {
            "monitoring.serenacodes.com/pod-monitor-opt-in": "true",
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
        remoteWrite: [
          {
            url: "https://prometheus-prod-10-prod-us-central-0.grafana.net/api/prom/push",
            basicAuth: {
              username: {
                name: "grafana-cloud",
                key: "username",
              },
              password: {
                name: "grafana-cloud",
                key: "password",
              },
            },
          },
        ],
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
            metricRelabelings: [
              {
                sourceLabels: ["__name__"],
                regex: ".+_bucket",
                action: PodMonitorSpecPodMetricsEndpointsMetricRelabelingsAction.DROP,
              },
            ],
          },
          {
            port: "reloader-web",
            path: "/metrics",
            scheme: "http",
          },
        ],
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "prometheus",
          },
        },
      },
    });

    const prometheusService = new KubeService(this, "prometheus-nodeport", {
      metadata: {
        name: "prometheus-nodeport",
        namespace: namespace,
        labels: labels,
      },
      spec: {
        selector: {
          "app.kubernetes.io/name": "prometheus",
        },
        ports: [
          {
            port: 9090,
            targetPort: IntOrString.fromString("web"),
          },
        ],
      },
    });

    new KubeIngress(this, "prometheus-ingress", {
      metadata: {
        name: "monitoring-ingress",
        namespace: namespace,
        labels: labels,
      },
      spec: {
        ingressClassName: "nginx",
        rules: [
          {
            host: "prometheus.internal.serenacodes.com",
            http: {
              paths: [
                {
                  backend: {
                    service: {
                      name: prometheusService.name,
                      port: {
                        name: "web",
                      },
                    },
                  },
                  path: "/",
                  pathType: "Prefix",
                },
              ],
            },
          },
        ],
      },
    });

    const nodeExporterLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "exporter",
      "app.kubernetes.io/name": "node-exporter",
    });

    const sysfsVolume: Volume = {
      hostPath: {
        path: "/sys",
        type: "Directory",
      },
      name: "sysfs",
    };

    const rootVolume: Volume = {
      hostPath: {
        path: "/",
        type: "Directory",
      },
      name: "root",
    };

    const procfsVolume: Volume = {
      hostPath: {
        path: "/proc",
        type: "Directory",
      },
      name: "procfs",
    };

    new KubeDaemonSet(this, "node-exporter", {
      metadata: {
        name: "node-exporter",
        namespace: namespace,
        labels: nodeExporterLabels,
      },
      spec: {
        selector: {
          matchLabels: nodeExporterLabels,
        },
        template: {
          metadata: {
            labels: nodeExporterLabels,
          },
          spec: {
            containers: [
              {
                name: "node-exporter",
                image: "quay.io/prometheus/node-exporter:v1.3.1",
                args: [
                  "--path.procfs=/host/proc",
                  "--path.rootfs=/host/root",
                  "--path.sysfs=/host/sys",
                  "--collector.disable-defaults",
                  "--collector.filesystem",
                  "--collector.meminfo",
                  "--collector.hwmon",
                  "--collector.cpufreq",
                  "--collector.loadavg",
                  "--web.disable-exporter-metrics",
                ],
                ports: [
                  {
                    containerPort: 9100,
                    protocol: "TCP",
                    name: "web",
                  },
                ],
                resources: {
                  requests: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("200Mi"),
                  },
                },
                volumeMounts: [
                  {
                    mountPath: "/host/sys",
                    mountPropagation: "HostToContainer",
                    name: sysfsVolume.name,
                    readOnly: true,
                  },
                  {
                    mountPath: "/host/root",
                    mountPropagation: "HostToContainer",
                    name: rootVolume.name,
                    readOnly: true,
                  },
                  {
                    mountPath: "/host/proc",
                    mountPropagation: "HostToContainer",
                    name: procfsVolume.name,
                    readOnly: true,
                  },
                ],
              },
            ],
            volumes: [rootVolume, sysfsVolume, procfsVolume],
            tolerations: [
              {
                operator: "Exists",
              },
            ],
          },
        },
      },
    });

    new PodMonitor(this, "node-exporter-monitor", {
      metadata: {
        name: "node-exporter-monitor",
        namespace: namespace,
        labels: monitoringLabels,
      },
      spec: {
        podMetricsEndpoints: [
          {
            port: "web",
            path: "/metrics",
            scheme: "http",
            metricRelabelings: [
              {
                sourceLabels: ["fstype"],
                regex: "(ext4|bpf|vfat)",
                action: PodMonitorSpecPodMetricsEndpointsMetricRelabelingsAction.KEEP,
              },
            ],
          },
        ],
        selector: {
          matchLabels: nodeExporterLabels,
        },
      },
    });
  }
}
