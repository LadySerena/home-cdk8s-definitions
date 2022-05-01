import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeConfigMap,
  KubeDeployment,
  KubeIngressClass,
  KubeJob,
  KubeNamespace,
  KubeRole,
  KubeRoleBinding,
  KubeService,
  KubeServiceAccount,
  KubeValidatingWebhookConfiguration,
  Quantity,
} from "../imports/k8s";
import { rbacGroup, readVerbs } from "./Constants";

export interface NginxProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class IngressNginx extends Construct {
  constructor(scope: Construct, id: string, props: NginxProps) {
    super(scope, id);
    const name = props.name || "ingress-nginx";
    const namespace = props.namespace || "ingress-nginx";
    const labels = props.labels || StandardLabels("ingress-nginx");

    const controllerName = "k8s.io/ingress-nginx";
    const className = "nginx";

    new KubeNamespace(this, "nginx-namespace", {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    const ingressServiceAccount = new KubeServiceAccount(this, "ingress-nginx-service-account", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
    });

    const admissionServiceAccount = new KubeServiceAccount(this, "admission-service-account", {
      metadata: {
        name: `${name}-admission`,
        namespace: namespace,
        labels: labels,
      },
    });

    const ingressRole = new KubeRole(this, "ingress-role", {
      metadata: {
        name: `${namespace}:${name}`,
        namespace: namespace,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["namespaces"],
          verbs: ["get"],
        },
        {
          apiGroups: [""],
          resources: ["configmaps", "pods", "secrets", "endpoints"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses/status"],
          verbs: ["update"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingressclasses"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resourceNames: ["ingress-controller-leader"],
          resources: ["configmaps"],
          verbs: ["get", "update"],
        },
        {
          apiGroups: [""],
          resources: ["configmaps"],
          verbs: ["create"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    const admissionRole = new KubeRole(this, "admission-role", {
      metadata: {
        name: `${namespace}:${name}-admission`,
        namespace: namespace,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "create"],
        },
      ],
    });

    const ingressClusterRole = new KubeClusterRole(this, "ingress-cluster-role", {
      metadata: {
        name: `${namespace}:${name}`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["configmaps", "endpoints", "nodes", "pods", "secrets", "namespaces"],
          verbs: ["list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get"],
        },
        {
          apiGroups: [""],
          resources: ["services"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses/status"],
          verbs: ["update"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingressclasses"],
          verbs: readVerbs,
        },
      ],
    });

    const admissionClusterRole = new KubeClusterRole(this, "admission-cluster-role", {
      metadata: {
        name: `${namespace}:${name}-admission`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["admissionregistration.k8s.io"],
          resources: ["validatingwebhookconfigurations"],
          verbs: ["get", "update"],
        },
      ],
    });

    new KubeRoleBinding(this, "ingress-role-binding", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: ingressRole.kind,
        name: ingressRole.name,
      },
      subjects: [
        {
          kind: ingressServiceAccount.kind,
          name: ingressServiceAccount.name,
          namespace: namespace,
        },
      ],
    });

    new KubeRoleBinding(this, "admission-role-binding", {
      metadata: {
        name: `${name}-admission`,
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: admissionRole.kind,
        name: admissionRole.name,
      },
      subjects: [
        {
          kind: admissionServiceAccount.kind,
          name: admissionServiceAccount.name,
          namespace: namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "ingress-cluster-role-binding", {
      metadata: {
        name: `${namespace}:${name}`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: ingressClusterRole.kind,
        name: ingressClusterRole.name,
      },
      subjects: [
        {
          kind: ingressServiceAccount.kind,
          name: ingressServiceAccount.name,
          namespace: ingressServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "admission-cluster-role-binding", {
      metadata: {
        name: `${namespace}:${name}-admission`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: admissionClusterRole.kind,
        name: admissionClusterRole.name,
      },
      subjects: [
        {
          kind: admissionServiceAccount.kind,
          name: admissionServiceAccount.name,
          namespace: admissionServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeConfigMap(this, "ingress-config-map", {
      metadata: {
        name: `${name}-controller`,
        namespace: namespace,
        labels: labels,
      },
      data: {
        "allow-snippet-annotations": "true",
      },
    });

    new KubeService(this, "ingress-service", {
      metadata: {
        name: `${name}-controller`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        ports: [
          {
            appProtocol: "http",
            name: "http",
            port: 80,
            protocol: "TCP",
            targetPort: IntOrString.fromString("http"),
          },
          {
            appProtocol: "https",
            name: "https",
            port: 443,
            protocol: "TCP",
            targetPort: IntOrString.fromString("https"),
          },
        ],
        selector: labels,
        type: "LoadBalancer",
      },
    });

    const webhookService = new KubeService(this, "ingress-webhook-service", {
      metadata: {
        name: `${name}-controller-admission`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        ports: [
          {
            appProtocol: "https",
            name: "https-webhook",
            port: 443,
            targetPort: IntOrString.fromString("webhook"),
          },
        ],
        selector: labels,
        type: "ClusterIP",
      },
    });

    new KubeDeployment(this, "controller-deployment", {
      metadata: {
        name: `${name}-controller`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        minReadySeconds: 0,
        revisionHistoryLimit: 10,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            containers: [
              {
                args: [
                  "/nginx-ingress-controller",
                  "--election-id=ingress-controller-leader",
                  `--controller-class=${controllerName}`,
                  `--ingress-class=${className}`,
                  "--configmap=$(POD_NAMESPACE)/ingress-nginx-controller",
                  "--validating-webhook=:8443",
                  "--validating-webhook-certificate=/usr/local/certificates/cert",
                  "--validating-webhook-key=/usr/local/certificates/key",
                ],
                env: [
                  {
                    name: "POD_NAME",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.name",
                      },
                    },
                  },
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "LD_PRELOAD",
                    value: "/usr/local/lib/libmimalloc.so",
                  },
                ],
                image: "gcr.io/k8s-staging-ingress-nginx/controller-chroot:v1.2.0",
                imagePullPolicy: "IfNotPresent",
                lifecycle: {
                  preStop: {
                    exec: {
                      command: ["/wait-shutdown"],
                    },
                  },
                },
                livenessProbe: {
                  failureThreshold: 5,
                  httpGet: {
                    path: "/healthz",
                    port: IntOrString.fromNumber(10254),
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  successThreshold: 1,
                  timeoutSeconds: 1,
                },
                name: "controller",
                ports: [
                  {
                    containerPort: 80,
                    name: "http",
                    protocol: "TCP",
                  },
                  {
                    containerPort: 443,
                    name: "https",
                    protocol: "TCP",
                  },
                  {
                    containerPort: 8443,
                    name: "webhook",
                    protocol: "TCP",
                  },
                ],
                readinessProbe: {
                  failureThreshold: 3,
                  httpGet: {
                    path: "/healthz",
                    port: IntOrString.fromNumber(10254),
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 10,
                  successThreshold: 1,
                  timeoutSeconds: 1,
                },
                resources: {
                  requests: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("90Mi"),
                  },
                },
                securityContext: {
                  allowPrivilegeEscalation: true,
                  capabilities: {
                    add: ["NET_BIND_SERVICE", "SYS_CHROOT"],
                    drop: ["ALL"],
                  },
                  runAsUser: 101,
                },
                volumeMounts: [
                  {
                    mountPath: "/usr/local/certificates/",
                    name: "webhook-cert",
                    readOnly: true,
                  },
                ],
              },
            ],
            dnsPolicy: "ClusterFirst",
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            serviceAccountName: ingressServiceAccount.name,
            terminationGracePeriodSeconds: 300,
            volumes: [
              {
                name: "webhook-cert",
                secret: {
                  secretName: "ingress-nginx-admission",
                },
              },
            ],
          },
        },
      },
    });

    const admissionSecret = `${name}-admission`;

    new KubeJob(this, "admission-create-job", {
      metadata: {
        name: `${name}-admission-create`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        template: {
          metadata: {
            labels: labels,
            name: `${name}-admission-create`,
          },
          spec: {
            containers: [
              {
                args: [
                  "create",
                  "--host=ingress-nginx-controller-admission,ingress-nginx-controller-admission.$(POD_NAMESPACE).svc",
                  "--namespace=$(POD_NAMESPACE)",
                  `--secret-name=${admissionSecret}`,
                ],
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
                image:
                  "k8s.gcr.io/ingress-nginx/kube-webhook-certgen:v1.1.1@sha256:64d8c73dca984af206adf9d6d7e46aa550362b1d7a01f3a0a91b20cc67868660",
                imagePullPolicy: "IfNotPresent",
                name: "create",
                securityContext: {
                  allowPrivilegeEscalation: false,
                },
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            restartPolicy: "OnFailure",
            securityContext: {
              fsGroup: 2000,
              runAsNonRoot: true,
              runAsUser: 2000,
            },
            serviceAccountName: admissionServiceAccount.name,
          },
        },
      },
    });

    new KubeJob(this, "admission-patch-job", {
      metadata: {
        name: `${name}-admission-patch`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        template: {
          metadata: {
            labels: labels,
            name: `${name}-admission-patch`,
          },
          spec: {
            containers: [
              {
                args: [
                  "patch",
                  "--webhook-name=ingress-nginx-admission",
                  "--namespace=$(POD_NAMESPACE)",
                  "--patch-mutating=false",
                  `--secret-name=${admissionSecret}`,
                  "--patch-failure-policy=Fail",
                ],
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
                image:
                  "k8s.gcr.io/ingress-nginx/kube-webhook-certgen:v1.1.1@sha256:64d8c73dca984af206adf9d6d7e46aa550362b1d7a01f3a0a91b20cc67868660",
                imagePullPolicy: "IfNotPresent",
                name: "patch",
                securityContext: {
                  allowPrivilegeEscalation: false,
                },
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            restartPolicy: "OnFailure",
            securityContext: {
              fsGroup: 2000,
              runAsNonRoot: true,
              runAsUser: 2000,
            },
            serviceAccountName: admissionServiceAccount.name,
          },
        },
      },
    });

    new KubeIngressClass(this, "ingress-class", {
      metadata: {
        name: className,
        labels: labels,
      },
      spec: {
        controller: controllerName,
      },
    });

    new KubeValidatingWebhookConfiguration(this, "ingress-webhook-configuration", {
      metadata: {
        name: `${name}-admission`,
        labels: labels,
      },
      webhooks: [
        {
          admissionReviewVersions: ["v1"],
          clientConfig: {
            service: {
              name: webhookService.name,
              namespace: namespace,
              path: "/networking/v1/ingresses",
            },
          },
          failurePolicy: "Fail",
          matchPolicy: "Equivalent",
          name: "validate.nginx.ingress.kubernetes.io",
          rules: [
            {
              apiGroups: ["networking.k8s.io"],
              apiVersions: ["v1"],
              operations: ["CREATE", "UPDATE"],
              resources: ["ingresses"],
            },
          ],
          sideEffects: "None",
        },
      ],
    });
  }
}
