import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeConfigMap,
  KubeDaemonSet,
  KubeDeployment,
  KubeNamespace,
  KubeRole,
  KubeRoleBinding,
  KubeServiceAccount,
} from "../imports/k8s";
import { rbacGroup, readVerbs } from "./Constants";

export interface MetallbProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class Metallb extends Construct {
  constructor(scope: Construct, id: string, props: MetallbProps) {
    super(scope, id);

    const standardLabels = StandardLabels("metallb");

    const labels = props.labels || standardLabels;
    const namespace = props.namespace || "metallb-system";

    new KubeNamespace(this, namespace, {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    const controllerServiceAccount = new KubeServiceAccount(this, "controller-service-account", {
      metadata: {
        name: "controller",
        namespace: namespace,
        labels: labels,
      },
    });

    const speakerServiceAccount = new KubeServiceAccount(this, "speaker-service-account", {
      metadata: {
        name: "speaker",
        namespace: namespace,
        labels: labels,
      },
    });

    const controllerClusterRole = new KubeClusterRole(this, "controller-clusterrole", {
      metadata: {
        name: `${namespace}:controller`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["services/status"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["policy"],
          resourceNames: ["controller"],
          resources: ["podsecuritypolicies"],
          verbs: ["use"],
        },
      ],
    });

    const speakerClusterRole = new KubeClusterRole(this, "speaker-clusterrole", {
      metadata: {
        name: `${namespace}:speaker`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["services", "endpoints", "nodes"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["discovery.k8s.io"],
          resources: ["endpointslices"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["policy"],
          resourceNames: ["speaker"],
          resources: ["podsecuritypolicies"],
          verbs: ["use"],
        },
      ],
    });

    const configWatcherRole = new KubeRole(this, "config-watcher", {
      metadata: {
        name: "config-watcher",
        labels: labels,
        namespace: namespace,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["configmaps"],
          verbs: readVerbs,
        },
      ],
    });

    const podListerRole = new KubeRole(this, "pod-lister", {
      metadata: {
        name: "pod-lister",
        labels: labels,
        namespace: namespace,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["pods"],
          verbs: ["list"],
        },
      ],
    });

    const controllerRole = new KubeRole(this, "controller", {
      metadata: {
        name: "controller",
        labels: labels,
        namespace: namespace,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["create"],
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          resourceNames: ["memberlist"],
          verbs: ["list"],
        },
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          resourceNames: ["controller"],
          verbs: ["get"],
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controller-cluster-role-binding", {
      metadata: {
        name: `${namespace}:controller`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerClusterRole.kind,
        name: controllerClusterRole.name,
      },
      subjects: [
        {
          kind: controllerServiceAccount.kind,
          name: controllerServiceAccount.name,
          namespace: controllerServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "speaker-binding", {
      metadata: {
        name: `${namespace}:speaker`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: speakerClusterRole.kind,
        name: speakerClusterRole.name,
      },
      subjects: [
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.name,
          namespace: speakerServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeRoleBinding(this, "config-watcher-binding", {
      metadata: {
        name: "config-watcher",
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: configWatcherRole.kind,
        name: configWatcherRole.name,
      },
      subjects: [
        {
          kind: controllerServiceAccount.kind,
          name: controllerServiceAccount.name,
        },
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.name,
        },
      ],
    });

    new KubeRoleBinding(this, "pod-lister-binding", {
      metadata: {
        name: "pod-lister",
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: podListerRole.kind,
        name: podListerRole.name,
      },
      subjects: [
        {
          kind: speakerServiceAccount.kind,
          name: speakerServiceAccount.name,
        },
      ],
    });

    new KubeRoleBinding(this, "controller-binding", {
      metadata: {
        name: "controller",
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerRole.kind,
        name: controllerRole.name,
      },
      subjects: [
        {
          kind: controllerServiceAccount.kind,
          name: controllerServiceAccount.name,
        },
      ],
    });

    const speakerLabels = Object.assign({}, labels, { "app.kubernetes.io/component": "speaker" });
    new KubeDaemonSet(this, "speaker-daemonset", {
      metadata: {
        name: "speaker",
        namespace: namespace,
        labels: speakerLabels,
      },
      spec: {
        selector: {
          matchLabels: speakerLabels,
        },
        template: {
          metadata: {
            annotations: {
              "prometheus.io/port": "7472",
              "prometheus.io/scrape": "true",
            },
            labels: speakerLabels,
          },
          spec: {
            containers: [
              {
                args: ["--port=7472", "--config=config", "--log-level=info"],
                env: [
                  {
                    name: "METALLB_NODE_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "METALLB_HOST",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "status.hostIP",
                      },
                    },
                  },
                  {
                    name: "METALLB_ML_BIND_ADDR",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "status.podIP",
                      },
                    },
                  },
                  {
                    name: "METALLB_ML_LABELS",
                    value: "app=metallb,component=speaker",
                  },
                  {
                    name: "METALLB_ML_SECRET_KEY",
                    valueFrom: {
                      secretKeyRef: {
                        name: "memberlist",
                        key: "secretkey",
                      },
                    },
                  },
                ],
                image: "quay.io/metallb/speaker:v0.12.1",
                name: "speaker",
                ports: [
                  {
                    containerPort: 7472,
                    name: "monitoring",
                  },
                  {
                    containerPort: 7946,
                    name: "memberlist-tcp",
                  },
                  {
                    containerPort: 7946,
                    name: "memberlist-udp",
                    protocol: "UDP",
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: "/metrics",
                    port: IntOrString.fromString("monitoring"),
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/metrics",
                    port: IntOrString.fromString("monitoring"),
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: {
                    add: ["NET_RAW"],
                    drop: ["ALL"],
                  },
                  readOnlyRootFilesystem: true,
                },
              },
            ],
            hostNetwork: true,
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            serviceAccountName: speakerServiceAccount.name,
            terminationGracePeriodSeconds: 2,
            tolerations: [
              {
                effect: "NoSchedule",
                key: "node-role.kubernetes.io/master",
                operator: "Exists",
              },
            ],
          },
        },
      },
    });

    const controllerLabels = Object.assign({}, labels, { "app.kubernetes.io/component": "controller" });

    new KubeDeployment(this, "controller-deployment", {
      metadata: {
        name: "controller",
        namespace: namespace,
        labels: controllerLabels,
      },
      spec: {
        revisionHistoryLimit: 3,
        selector: {
          matchLabels: controllerLabels,
        },
        template: {
          metadata: {
            annotations: {
              "prometheus.io/port": "7472",
              "prometheus.io/scrape": "true",
            },
            labels: controllerLabels,
          },
          spec: {
            containers: [
              {
                args: ["--port=7472", "--config=config", "--log-level=info"],
                env: [
                  {
                    name: "METALLB_ML_SECRET_NAME",
                    value: "memberlist",
                  },
                  {
                    name: "METALLB_DEPLOYMENT",
                    value: "controller",
                  },
                ],
                image: "quay.io/metallb/controller:v0.12.1",
                name: "controller",
                ports: [
                  {
                    containerPort: 7472,
                    name: "monitoring",
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: "/metrics",
                    port: IntOrString.fromString("monitoring"),
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/metrics",
                    port: IntOrString.fromString("monitoring"),
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: {
                    drop: ["all"],
                  },
                  readOnlyRootFilesystem: true,
                },
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 65534,
              fsGroup: 65534,
            },
            serviceAccountName: controllerServiceAccount.name,
            terminationGracePeriodSeconds: 0,
          },
        },
      },
    });

    new KubeConfigMap(this, "ip-range-configmap", {
      metadata: {
        name: "config",
        namespace: namespace,
      },
      data: {
        config: "address-pools:\n- name: default\n  protocol: layer2\n  addresses:\n  - 10.1.192.0/18\n",
      },
    });
  }
}
