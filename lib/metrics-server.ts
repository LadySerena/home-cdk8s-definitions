import { Construct } from "constructs";
import {
  IntOrString,
  KubeApiService,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeDeployment,
  KubeRoleBinding,
  KubeService,
  KubeServiceAccount,
} from "../imports/k8s";
import { StandardLabels } from "./standardLabels";
import { readVerbs } from "./Constants";

export interface MetricsServerProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class MetricsServer extends Construct {
  constructor(scope: Construct, id: string, props: MetricsServerProps) {
    super(scope, id);
    const standardLabels = StandardLabels("metrics-server");

    const name = props.name || "metrics-server";
    const labels = props.labels || standardLabels;
    const namespace = props.namespace || "kube-system";
    const rbacAPIGroup = "rbac.authorization.k8s.io";

    const roleAggregatedLabels = Object.assign({}, labels, {
      "rbac.authorization.k8s.io/aggregate-to-admin": "true",
      "rbac.authorization.k8s.io/aggregate-to-edit": "true",
      "rbac.authorization.k8s.io/aggregate-to-view": "true",
    });

    const metricServerServiceAccount = new KubeServiceAccount(
      this,
      "metrics-server-sa",
      {
        metadata: {
          name: name,
          namespace: namespace,
          labels: labels,
        },
      }
    );

    new KubeClusterRole(this, "metrics-server-aggregated-reader", {
      metadata: {
        name: "system:metrics-server-aggregated-reader",
        labels: roleAggregatedLabels,
      },
      rules: [
        {
          apiGroups: ["metrics.k8s.io"],
          resources: ["pods", "nodes"],
          verbs: readVerbs,
        },
      ],
    });

    const metricsServerClusterRole = new KubeClusterRole(
      this,
      "metrics-server-clusterrole",
      {
        metadata: {
          name: "system:metrics-server",
          labels: labels,
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["nodes/metrics"],
            verbs: ["get"],
          },
          {
            apiGroups: [""],
            resources: ["pods", "nodes", "namespaces", "configmaps"],
            verbs: readVerbs,
          },
        ],
      }
    );

    new KubeClusterRoleBinding(this, "metrics-server-auth-delegator", {
      metadata: {
        name: "metrics-server:system:auth-delegator",
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacAPIGroup,
        kind: "ClusterRole",
        name: "system:auth-delegator",
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: metricServerServiceAccount.name,
          namespace: metricServerServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "metrics-sever-clusterrolebinding", {
      metadata: {
        name: "system:metrics-server",
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacAPIGroup,
        kind: "ClusterRole",
        name: metricsServerClusterRole.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: metricServerServiceAccount.name,
          namespace: metricServerServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeRoleBinding(this, "metrics-server-auth-reader-rolebinding", {
      metadata: {
        name: "metrics-server-auth-reader",
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacAPIGroup,
        kind: "Role",
        name: "extension-apiserver-authentication-reader",
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: metricServerServiceAccount.name,
          namespace: metricServerServiceAccount.metadata.namespace,
        },
      ],
    });

    const containerPortName = "https";
    const metricsService = new KubeService(this, "metrics-server-service", {
      metadata: {
        name,
        namespace: namespace,
      },
      spec: {
        type: "ClusterIP",
        ports: [
          {
            name: "https",
            port: 443,
            protocol: "TCP",
            targetPort: IntOrString.fromString(containerPortName),
          },
        ],
        selector: labels,
      },
    });

    const volumeName = "tmp";
    new KubeDeployment(this, "metrics-server-deploy", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            serviceAccountName: metricServerServiceAccount.name,
            priorityClassName: "system-cluster-critical",
            containers: [
              {
                name: "metrics-server",
                securityContext: {
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  runAsNonRoot: true,
                  runAsUser: 1000,
                },
                image: "k8s.gcr.io/metrics-server/metrics-server:v0.6.1",
                imagePullPolicy: "IfNotPresent",
                args: [
                  "--secure-port=4443",
                  "--cert-dir=/tmp",
                  "--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname",
                  "--kubelet-use-node-status-port",
                  "--metric-resolution=30s",
                  "--kubelet-insecure-tls",
                ],
                ports: [
                  {
                    name: containerPortName,
                    protocol: "TCP",
                    containerPort: 4443,
                  },
                ],
                livenessProbe: {
                  initialDelaySeconds: 15,
                  failureThreshold: 4,
                  periodSeconds: 10,
                  httpGet: {
                    path: "/livez",
                    port: IntOrString.fromString(containerPortName),
                    scheme: "HTTPS",
                  },
                },
                readinessProbe: {
                  initialDelaySeconds: 20,
                  failureThreshold: 3,
                  periodSeconds: 10,
                  httpGet: {
                    path: "/readyz",
                    port: IntOrString.fromString(containerPortName),
                    scheme: "HTTPS",
                  },
                },
                volumeMounts: [
                  {
                    name: volumeName,
                    mountPath: "/tmp",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: volumeName,
                emptyDir: {},
              },
            ],
          },
        },
      },
    });

    new KubeApiService(this, "metrics-api-registration", {
      metadata: {
        name: "v1beta1.metrics.k8s.io",
        labels: labels,
      },
      spec: {
        group: "metrics.k8s.io",
        groupPriorityMinimum: 100,
        insecureSkipTlsVerify: true,
        service: {
          name: metricsService.name,
          namespace: namespace,
        },
        version: "v1beta1",
        versionPriority: 100,
      },
    });
  }
}
