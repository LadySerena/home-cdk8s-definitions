import { Construct } from "constructs";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeConfigMap,
  KubeDaemonSet,
  KubeDeployment,
  KubeIngress,
  KubeService,
  KubeServiceAccount,
  Quantity,
} from "../imports/k8s";
import { StandardLabels } from "./standardLabels";
import { readVerbs } from "./Constants";
import { Certificate, ClusterIssuer } from "../imports/cert-manager.io";

export interface CiliumProps {
  readonly clusterIssuer: ClusterIssuer;
}

export class Cilium extends Construct {
  constructor(scope: Construct, id: string, props: CiliumProps) {
    super(scope, id);

    const name = "cilium";
    const namespace = "kube-system";
    const labels = StandardLabels(name);

    const ciliumServiceAccount = new KubeServiceAccount(this, "cilium-service-account", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
    });

    const operatorServiceAccount = new KubeServiceAccount(this, "operator-service-account", {
      metadata: {
        name: `${name}-operator`,
        namespace: namespace,
        labels: labels,
      },
    });

    const hubbleRelayServiceAccount = new KubeServiceAccount(this, "hubble-relay-service-account", {
      metadata: {
        name: "hubble-relay",
        namespace: namespace,
        labels: labels,
      },
    });

    const hubbleUIServiceAccount = new KubeServiceAccount(this, "hubble-ui-service-account", {
      metadata: {
        name: "hubble-ui",
        namespace: namespace,
        labels: labels,
      },
    });

    const relaySecret = "hubble-relay-client-certs";

    new Certificate(this, "relayClientCerts", {
      metadata: {
        name: relaySecret,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        issuerRef: {
          group: props.clusterIssuer.apiGroup,
          kind: props.clusterIssuer.kind,
          name: props.clusterIssuer.name,
        },
        secretName: relaySecret,
        commonName: "*.hubble-relay.cilium.io",
        dnsNames: ["*.hubble-relay.cilium.io"],
        duration: "26280h",
      },
    });

    const hubbleSecret = "hubble-server-certs";

    new Certificate(this, "hubbleServerCerts", {
      metadata: {
        name: hubbleSecret,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        issuerRef: {
          group: props.clusterIssuer.apiGroup,
          kind: props.clusterIssuer.kind,
          name: props.clusterIssuer.name,
        },
        secretName: hubbleSecret,
        commonName: "*.default.hubble-grpc.cilium.io",
        dnsNames: ["*.default.hubble-grpc.cilium.io"],
        duration: "26280h",
      },
    });

    const ciliumConfig = new KubeConfigMap(this, "cilium-config", {
      metadata: {
        name: `${name}-config`,
        namespace: namespace,
      },
      data: {
        "identity-allocation-mode": "crd",
        "cilium-endpoint-gc-interval": "5m0s",
        "disable-endpoint-crd": "false",
        debug: "false",
        "enable-policy": "default",
        "enable-ipv4": "true",
        "enable-ipv6": "false",
        "custom-cni-conf": "false",
        "enable-bpf-clock-probe": "true",
        "monitor-aggregation": "medium",
        "monitor-aggregation-interval": "5s",
        "monitor-aggregation-flags": "all",
        "bpf-map-dynamic-size-ratio": "0.0025",
        "bpf-policy-map-max": "16384",
        "bpf-lb-map-max": "65536",
        "bpf-lb-external-clusterip": "false",
        "preallocate-bpf-maps": "false",
        "sidecar-istio-proxy-image": "cilium/istio_proxy",
        "cluster-name": "default",
        "cluster-id": "",
        tunnel: "geneve",
        "enable-l7-proxy": "true",
        "enable-ipv4-masquerade": "true",
        "enable-ipv6-masquerade": "true",
        "enable-xt-socket-fallback": "true",
        "install-iptables-rules": "true",
        "install-no-conntrack-iptables-rules": "false",
        "auto-direct-node-routes": "false",
        "enable-bandwidth-manager": "false",
        "enable-local-redirect-policy": "false",
        "kube-proxy-replacement": "strict",
        "kube-proxy-replacement-healthz-bind-address": "",
        "enable-health-check-nodeport": "true",
        "node-port-bind-protection": "true",
        "enable-auto-protect-node-port-range": "true",
        "enable-session-affinity": "true",
        "enable-l2-neigh-discovery": "true",
        "enable-endpoint-health-checking": "true",
        "enable-health-checking": "true",
        "enable-well-known-identities": "false",
        "enable-remote-node-identity": "true",
        "operator-api-serve-addr": "127.0.0.1:9234",
        "enable-hubble": "true",
        "hubble-socket-path": "/var/run/cilium/hubble.sock",
        "hubble-metrics-server": ":9091",
        "hubble-metrics": "dns drop tcp flow icmp http",
        "hubble-listen-address": ":4244",
        "hubble-disable-tls": "false",
        "hubble-tls-cert-file": "/var/lib/cilium/tls/hubble/server.crt",
        "hubble-tls-key-file": "/var/lib/cilium/tls/hubble/server.key",
        "hubble-tls-client-ca-files": "/var/lib/cilium/tls/hubble/client-ca.crt",
        ipam: "cluster-pool",
        "cluster-pool-ipv4-cidr": "10.0.128.0/17",
        "cluster-pool-ipv4-mask-size": "24",
        "disable-cnp-status-updates": "true",
        "cgroup-root": "/run/cilium/cgroupv2",
        "enable-k8s-terminating-endpoint": "true",
      },
    });

    const hubbleRelayConfig = new KubeConfigMap(this, "hubble-relay-config", {
      metadata: {
        name: "hubble-relay-config",
        namespace: namespace,
        labels: labels,
      },
      data: {
        "config.yaml":
          "peer-service: unix:///var/run/cilium/hubble.sock\nlisten-address: :4245\ndial-timeout: \nretry-timeout: \nsort-buffer-len-max: \nsort-buffer-drain-timeout: \ntls-client-cert-file: /var/lib/hubble-relay/tls/client.crt\ntls-client-key-file: /var/lib/hubble-relay/tls/client.key\ntls-hubble-server-ca-files: /var/lib/hubble-relay/tls/hubble-server-ca.crt\ndisable-server-tls: true\n",
      },
    });

    const envoyUiProxyPort = Number(8081);
    const hubbleUIEnvoyConfig = new KubeConfigMap(this, "hubble-ui-envoy-config", {
      metadata: {
        name: "hubble-ui-envoy",
        namespace: namespace,
        labels: labels,
      },
      data: {
        "envoy.yaml":
          "static_resources:\n  listeners:\n    - name: listener_hubble_ui\n      address:\n        socket_address:\n          address: 0.0.0.0\n          port_value: " +
          envoyUiProxyPort.toString() +
          '\n      filter_chains:\n        - filters:\n            - name: envoy.filters.network.http_connection_manager\n              typed_config:\n                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager\n                codec_type: auto\n                stat_prefix: ingress_http\n                route_config:\n                  name: local_route\n                  virtual_hosts:\n                    - name: local_service\n                      domains: ["*"]\n                      routes:\n                        - match:\n                            prefix: "/api/"\n                          route:\n                            cluster: backend\n                            prefix_rewrite: "/"\n                            timeout: 0s\n                            max_stream_duration:\n                              grpc_timeout_header_max: 0s\n                        - match:\n                            prefix: "/"\n                          route:\n                            cluster: frontend\n                      cors:\n                        allow_origin_string_match:\n                          - prefix: "*"\n                        allow_methods: GET, PUT, DELETE, POST, OPTIONS\n                        allow_headers: keep-alive,user-agent,cache-control,content-type,content-transfer-encoding,x-accept-content-transfer-encoding,x-accept-response-streaming,x-user-agent,x-grpc-web,grpc-timeout\n                        max_age: "1728000"\n                        expose_headers: grpc-status,grpc-message\n                http_filters:\n                  - name: envoy.filters.http.grpc_web\n                  - name: envoy.filters.http.cors\n                  - name: envoy.filters.http.router\n  clusters:\n    - name: frontend\n      connect_timeout: 0.25s\n      type: strict_dns\n      lb_policy: round_robin\n      load_assignment:\n        cluster_name: frontend\n        endpoints:\n          - lb_endpoints:\n              - endpoint:\n                  address:\n                    socket_address:\n                      address: 127.0.0.1\n                      port_value: 8080\n    - name: backend\n      connect_timeout: 0.25s\n      type: logical_dns\n      lb_policy: round_robin\n      http2_protocol_options: {}\n      load_assignment:\n        cluster_name: backend\n        endpoints:\n          - lb_endpoints:\n              - endpoint:\n                  address:\n                    socket_address:\n                      address: 127.0.0.1\n                      port_value: 8090\n',
      },
    });

    const ciliumClusterRole = new KubeClusterRole(this, "cilium-cluster-role", {
      metadata: {
        name: `${namespace}:cilium`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["networkpolicies"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["discovery.k8s.io"],
          resources: ["endpointslices"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["namespaces", "services", "nodes", "endpoints"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["pods", "pods/finalizers"],
          verbs: ["get", "list", "watch", "update", "delete"],
        },
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: [""],
          resources: ["nodes", "nodes/status"],
          verbs: ["patch"],
        },
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["create", "list", "watch", "update", "get"],
        },
        {
          apiGroups: ["cilium.io"],
          resources: [
            "ciliumnetworkpolicies",
            "ciliumnetworkpolicies/status",
            "ciliumnetworkpolicies/finalizers",
            "ciliumclusterwidenetworkpolicies",
            "ciliumclusterwidenetworkpolicies/status",
            "ciliumclusterwidenetworkpolicies/finalizers",
            "ciliumendpoints",
            "ciliumendpoints/status",
            "ciliumendpoints/finalizers",
            "ciliumnodes",
            "ciliumnodes/status",
            "ciliumnodes/finalizers",
            "ciliumidentities",
            "ciliumidentities/finalizers",
            "ciliumlocalredirectpolicies",
            "ciliumlocalredirectpolicies/status",
            "ciliumlocalredirectpolicies/finalizers",
            "ciliumegressnatpolicies",
            "ciliumendpointslices",
          ],
          verbs: ["*"],
        },
      ],
    });

    const operatorClusterRole = new KubeClusterRole(this, "operator-cluster-role", {
      metadata: {
        name: `${namespace}-cilium-operator`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["pods"],
          verbs: ["get", "list", "watch", "delete"],
        },
        {
          apiGroups: ["discovery.k8s.io"],
          resources: ["endpointslices"],
          verbs: readVerbs,
        },
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
          resources: ["services", "endpoints", "namespaces"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["cilium.io"],
          resources: [
            "ciliumnetworkpolicies",
            "ciliumnetworkpolicies/status",
            "ciliumnetworkpolicies/finalizers",
            "ciliumclusterwidenetworkpolicies",
            "ciliumclusterwidenetworkpolicies/status",
            "ciliumclusterwidenetworkpolicies/finalizers",
            "ciliumendpoints",
            "ciliumendpoints/status",
            "ciliumendpoints/finalizers",
            "ciliumnodes",
            "ciliumnodes/status",
            "ciliumnodes/finalizers",
            "ciliumidentities",
            "ciliumendpointslices",
            "ciliumidentities/status",
            "ciliumidentities/finalizers",
            "ciliumlocalredirectpolicies",
            "ciliumlocalredirectpolicies/status",
            "ciliumlocalredirectpolicies/finalizers",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["create", "get", "list", "update", "watch"],
        },
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["create", "get", "update"],
        },
      ],
    });

    const uiClusterRole = new KubeClusterRole(this, "uiClusterRole", {
      metadata: {
        name: `${namespace}-hubble-ui`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["networkpolicies"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["componentstatuses", "endpoints", "namespaces", "nodes", "pods", "services"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["cilium.io"],
          resources: ["*"],
          verbs: readVerbs,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "ciliumBinding", {
      metadata: {
        name: `${namespace}-${name}`,
        labels: labels,
      },
      roleRef: {
        apiGroup: ciliumClusterRole.apiGroup,
        kind: ciliumClusterRole.kind,
        name: ciliumClusterRole.name,
      },
      subjects: [
        {
          kind: ciliumServiceAccount.kind,
          name: ciliumServiceAccount.name,
          namespace: ciliumServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "operatorBinding", {
      metadata: {
        name: `${namespace}-${name}-operator`,
        labels: labels,
      },
      roleRef: {
        apiGroup: operatorClusterRole.apiGroup,
        kind: operatorClusterRole.kind,
        name: operatorClusterRole.name,
      },
      subjects: [
        {
          kind: operatorServiceAccount.kind,
          name: operatorServiceAccount.name,
          namespace: operatorServiceAccount.metadata.namespace,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "uiBinding", {
      metadata: {
        name: `${namespace}-hubble-ui`,
        labels: labels,
      },
      roleRef: {
        apiGroup: uiClusterRole.apiGroup,
        kind: uiClusterRole.kind,
        name: uiClusterRole.name,
      },
      subjects: [
        {
          kind: hubbleUIServiceAccount.kind,
          name: hubbleUIServiceAccount.name,
          namespace: hubbleUIServiceAccount.metadata.namespace,
        },
      ],
    });

    const hubbleRelayLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "hubble-relay",
    });

    new KubeService(this, "relayService", {
      metadata: {
        name: "hubble-relay",
        namespace: namespace,
        labels: hubbleRelayLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: hubbleRelayLabels,
        ports: [
          {
            protocol: "TCP",
            port: 80,
            targetPort: IntOrString.fromNumber(4245),
          },
        ],
      },
    });

    const hubbleUiLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "hubble-ui",
    });

    const uiService = new KubeService(this, "uiService", {
      metadata: {
        name: "hubble-ui",
        namespace: namespace,
        labels: hubbleUiLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: hubbleUiLabels,
        ports: [
          {
            protocol: "TCP",
            port: 80,
            targetPort: IntOrString.fromNumber(envoyUiProxyPort),
          },
        ],
      },
    });

    const agentLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "agent",
    });

    const configVolumePath = "cilium-config-path";

    const hubbleTLSVolume = "hubble-tls";
    new KubeDaemonSet(this, "ciliumAgent", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: agentLabels,
      },
      spec: {
        selector: {
          matchLabels: agentLabels,
        },
        updateStrategy: {
          rollingUpdate: {
            maxUnavailable: IntOrString.fromNumber(2),
          },
          type: "RollingUpdate",
        },
        template: {
          metadata: {
            labels: agentLabels,
          },
          spec: {
            affinity: {
              nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: {
                  nodeSelectorTerms: [
                    {
                      matchExpressions: [
                        {
                          key: "kubernetes.io/os",
                          operator: "In",
                          values: ["linux"],
                        },
                      ],
                    },
                  ],
                },
              },
              podAntiAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: [
                  {
                    labelSelector: {
                      matchExpressions: [
                        {
                          key: "k8s-app",
                          operator: "In",
                          values: ["cilium"],
                        },
                      ],
                    },
                    topologyKey: "kubernetes.io/hostname",
                  },
                ],
              },
            },
            containers: [
              {
                name: "cilium-agent",
                image:
                  "quay.io/cilium/cilium:v1.11.1@sha256:251ff274acf22fd2067b29a31e9fda94253d2961c061577203621583d7e85bd2",
                imagePullPolicy: "IfNotPresent",
                command: ["cilium-agent"],
                args: ["--config-dir=/tmp/cilium/config-map"],
                startupProbe: {
                  httpGet: {
                    host: "127.0.0.1",
                    path: "/healthz",
                    port: IntOrString.fromNumber(9876),
                    scheme: "HTTP",
                    httpHeaders: [
                      {
                        name: "brief",
                        value: "true",
                      },
                    ],
                  },
                  failureThreshold: 105,
                  periodSeconds: 2,
                  successThreshold: 1,
                },
                livenessProbe: {
                  httpGet: {
                    host: "127.0.0.1",
                    path: "/healthz",
                    port: IntOrString.fromNumber(9876),
                    scheme: "HTTP",
                    httpHeaders: [
                      {
                        name: "brief",
                        value: "true",
                      },
                    ],
                  },
                  periodSeconds: 30,
                  successThreshold: 1,
                  failureThreshold: 10,
                  timeoutSeconds: 5,
                },
                readinessProbe: {
                  httpGet: {
                    host: "127.0.0.1",
                    path: "/healthz",
                    port: IntOrString.fromNumber(9876),
                    scheme: "HTTP",
                    httpHeaders: [
                      {
                        name: "brief",
                        value: "true",
                      },
                    ],
                  },
                  periodSeconds: 30,
                  successThreshold: 1,
                  failureThreshold: 3,
                  timeoutSeconds: 5,
                },
                env: [
                  {
                    name: "K8S_NODE_NAME",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "CILIUM_K8S_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "CILIUM_CLUSTERMESH_CONFIG",
                    value: "/var/lib/cilium/clustermesh/",
                  },
                  {
                    name: "CILIUM_CNI_CHAINING_MODE",
                    valueFrom: {
                      configMapKeyRef: {
                        name: ciliumConfig.name,
                        key: "cni-chaining-mode",
                        optional: true,
                      },
                    },
                  },
                  {
                    name: "CILIUM_CUSTOM_CNI_CONF",
                    valueFrom: {
                      configMapKeyRef: {
                        name: ciliumConfig.name,
                        key: "custom-cni-conf",
                        optional: true,
                      },
                    },
                  },
                  {
                    name: "KUBERNETES_SERVICE_HOST",
                    value: "kubernetes-control.internal.serenacodes.com",
                  },
                  {
                    name: "KUBERNETES_SERVICE_PORT",
                    value: "6443",
                  },
                ],
                lifecycle: {
                  postStart: {
                    exec: {
                      command: ["/cni-install.sh", "--enable-debug=false", "--cni-exclusive=true"],
                    },
                  },
                  preStop: {
                    exec: {
                      command: ["/cni-uninstall.sh"],
                    },
                  },
                },
                securityContext: {
                  privileged: true,
                },
                volumeMounts: [
                  {
                    name: "bpf-maps",
                    mountPath: "/sys/fs/bpf",
                    mountPropagation: "Bidirectional",
                  },
                  {
                    name: "cilium-run",
                    mountPath: "/var/run/cilium",
                  },
                  {
                    name: "cni-path",
                    mountPath: "/host/opt/cni/bin",
                  },
                  {
                    name: "etc-cni-netd",
                    mountPath: "/host/etc/cni/net.d",
                  },
                  {
                    name: "clustermesh-secrets",
                    mountPath: "/var/lib/cilium/clustermesh",
                    readOnly: true,
                  },
                  {
                    name: configVolumePath,
                    mountPath: "/tmp/cilium/config-map",
                    readOnly: true,
                  },
                  {
                    name: "lib-modules",
                    mountPath: "/lib/modules",
                    readOnly: true,
                  },
                  {
                    name: "xtables-lock",
                    mountPath: "/run/xtables.lock",
                  },
                  {
                    name: hubbleTLSVolume,
                    mountPath: "/var/lib/cilium/tls/hubble",
                    readOnly: true,
                  },
                ],
              },
            ],
            hostNetwork: true,
            initContainers: [
              {
                name: "mount-cgroup",
                image:
                  "quay.io/cilium/cilium:v1.11.1@sha256:251ff274acf22fd2067b29a31e9fda94253d2961c061577203621583d7e85bd2",
                imagePullPolicy: "IfNotPresent",
                env: [
                  {
                    name: "CGROUP_ROOT",
                    value: "/run/cilium/cgroupv2",
                  },
                  {
                    name: "BIN_PATH",
                    value: "/opt/cni/bin",
                  },
                ],
                command: [
                  "sh",
                  "-ec",
                  'cp /usr/bin/cilium-mount /hostbin/cilium-mount;\nnsenter --cgroup=/hostproc/1/ns/cgroup --mount=/hostproc/1/ns/mnt "${BIN_PATH}/cilium-mount" $CGROUP_ROOT;\nrm /hostbin/cilium-mount\n',
                ],
                volumeMounts: [
                  {
                    name: "hostproc",
                    mountPath: "/hostproc",
                  },
                  {
                    name: "cni-path",
                    mountPath: "/hostbin",
                  },
                ],
                securityContext: {
                  privileged: true,
                },
              },
              {
                name: "clean-cilium-state",
                image:
                  "quay.io/cilium/cilium:v1.11.1@sha256:251ff274acf22fd2067b29a31e9fda94253d2961c061577203621583d7e85bd2",
                imagePullPolicy: "IfNotPresent",
                command: ["/init-container.sh"],
                env: [
                  {
                    name: "CILIUM_ALL_STATE",
                    valueFrom: {
                      configMapKeyRef: {
                        name: ciliumConfig.name,
                        key: "clean-cilium-state",
                        optional: true,
                      },
                    },
                  },
                  {
                    name: "CILIUM_BPF_STATE",
                    valueFrom: {
                      configMapKeyRef: {
                        name: ciliumConfig.name,
                        key: "clean-cilium-bpf-state",
                        optional: true,
                      },
                    },
                  },
                  {
                    name: "KUBERNETES_SERVICE_HOST",
                    value: "kubernetes-control.internal.serenacodes.com",
                  },
                  {
                    name: "KUBERNETES_SERVICE_PORT",
                    value: "6443",
                  },
                ],
                securityContext: {
                  privileged: true,
                },
                volumeMounts: [
                  {
                    name: "bpf-maps",
                    mountPath: "/sys/fs/bpf",
                  },
                  {
                    name: "cilium-cgroup",
                    mountPath: "/run/cilium/cgroupv2",
                    mountPropagation: "HostToContainer",
                  },
                  {
                    name: "cilium-run",
                    mountPath: "/var/run/cilium",
                  },
                ],
                resources: {
                  requests: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("100Mi"),
                  },
                },
              },
            ],
            restartPolicy: "Always",
            priorityClassName: "system-node-critical",
            serviceAccountName: ciliumServiceAccount.name,
            terminationGracePeriodSeconds: 1,
            tolerations: [
              {
                operator: "Exists",
              },
            ],
            volumes: [
              {
                name: "cilium-run",
                hostPath: {
                  path: "/var/run/cilium",
                  type: "DirectoryOrCreate",
                },
              },
              {
                name: "bpf-maps",
                hostPath: {
                  path: "/sys/fs/bpf",
                  type: "DirectoryOrCreate",
                },
              },
              {
                name: "hostproc",
                hostPath: {
                  path: "/proc",
                  type: "Directory",
                },
              },
              {
                name: "cilium-cgroup",
                hostPath: {
                  path: "/run/cilium/cgroupv2",
                  type: "DirectoryOrCreate",
                },
              },
              {
                name: "cni-path",
                hostPath: {
                  path: "/opt/cni/bin",
                  type: "DirectoryOrCreate",
                },
              },
              {
                name: "etc-cni-netd",
                hostPath: {
                  path: "/etc/cni/net.d",
                  type: "DirectoryOrCreate",
                },
              },
              {
                name: "lib-modules",
                hostPath: {
                  path: "/lib/modules",
                },
              },
              {
                name: "xtables-lock",
                hostPath: {
                  path: "/run/xtables.lock",
                  type: "FileOrCreate",
                },
              },
              {
                name: "clustermesh-secrets",
                secret: {
                  secretName: "cilium-clustermesh",
                  defaultMode: 256,
                  optional: true,
                },
              },
              {
                name: configVolumePath,
                configMap: {
                  name: ciliumConfig.name,
                },
              },
              {
                name: hubbleTLSVolume,
                projected: {
                  defaultMode: 256,
                  sources: [
                    {
                      secret: {
                        name: hubbleSecret,
                        optional: true,
                        items: [
                          {
                            key: "ca.crt",
                            path: "client-ca.crt",
                          },
                          {
                            key: "tls.crt",
                            path: "server.crt",
                          },
                          {
                            key: "tls.key",
                            path: "server.key",
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    const operatorLabels = Object.assign({}, labels, {
      "io.cilium/app": "operator",
      "app.kubernetes.io/component": "operator",
    });

    new KubeDeployment(this, "operatorDeployment", {
      metadata: {
        name: `${name}-operator`,
        namespace: namespace,
        labels: operatorLabels,
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: operatorLabels,
        },
        strategy: {
          rollingUpdate: {
            maxSurge: IntOrString.fromNumber(1),
            maxUnavailable: IntOrString.fromNumber(1),
          },
          type: "RollingUpdate",
        },
        template: {
          metadata: {
            labels: operatorLabels,
          },
          spec: {
            affinity: {
              podAntiAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: [
                  {
                    labelSelector: {
                      matchLabels: operatorLabels,
                    },
                    topologyKey: "kubernetes.io/hostname",
                  },
                ],
              },
            },
            containers: [
              {
                name: "cilium-operator",
                image:
                  "quay.io/cilium/operator-generic:v1.11.1@sha256:977240a4783c7be821e215ead515da3093a10f4a7baea9f803511a2c2b44a235",
                imagePullPolicy: "IfNotPresent",
                command: ["cilium-operator-generic"],
                args: ["--config-dir=/tmp/cilium/config-map", "--debug=$(CILIUM_DEBUG)"],
                env: [
                  {
                    name: "K8S_NODE_NAME",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "spec.nodeName",
                      },
                    },
                  },
                  {
                    name: "CILIUM_K8S_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        apiVersion: "v1",
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                  {
                    name: "CILIUM_DEBUG",
                    valueFrom: {
                      configMapKeyRef: {
                        key: "debug",
                        name: "cilium-config",
                        optional: true,
                      },
                    },
                  },
                  {
                    name: "KUBERNETES_SERVICE_HOST",
                    value: "kubernetes-control.internal.serenacodes.com",
                  },
                  {
                    name: "KUBERNETES_SERVICE_PORT",
                    value: "6443",
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    host: "127.0.0.1",
                    path: "/healthz",
                    port: IntOrString.fromNumber(9234),
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 60,
                  periodSeconds: 10,
                  timeoutSeconds: 3,
                },
                volumeMounts: [
                  {
                    name: configVolumePath,
                    mountPath: "/tmp/cilium/config-map",
                    readOnly: true,
                  },
                ],
              },
            ],
            hostNetwork: true,
            restartPolicy: "Always",
            priorityClassName: "system-cluster-critical",
            serviceAccountName: operatorServiceAccount.name,
            tolerations: [
              {
                operator: "Exists",
              },
            ],
            volumes: [
              {
                name: configVolumePath,
                configMap: {
                  name: ciliumConfig.name,
                },
              },
            ],
          },
        },
      },
    });

    new KubeDeployment(this, "relayDeployment", {
      metadata: {
        name: "hubble-relay",
        namespace: namespace,
        labels: hubbleRelayLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: hubbleRelayLabels,
        },
        strategy: {
          rollingUpdate: {
            maxUnavailable: IntOrString.fromNumber(1),
          },
          type: "RollingUpdate",
        },
        template: {
          metadata: {
            labels: hubbleRelayLabels,
          },
          spec: {
            affinity: {
              podAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: [
                  {
                    labelSelector: {
                      matchLabels: hubbleRelayLabels,
                    },
                    topologyKey: "kubernetes.io/hostname",
                  },
                ],
              },
            },
            containers: [
              {
                name: "hubble-relay",
                image:
                  "quay.io/cilium/hubble-relay:v1.11.1@sha256:23d40b2a87a5bf94e0365bd9606721c96f78b8304b61725dca45a0b8a6048203",
                imagePullPolicy: "IfNotPresent",
                command: ["hubble-relay"],
                args: ["serve"],
                ports: [
                  {
                    name: "grpc",
                    containerPort: 4245,
                  },
                ],
                readinessProbe: {
                  tcpSocket: {
                    port: IntOrString.fromString("grpc"),
                  },
                },
                livenessProbe: {
                  tcpSocket: {
                    port: IntOrString.fromString("grpc"),
                  },
                },
                volumeMounts: [
                  {
                    name: "hubble-sock-dir",
                    mountPath: "/var/run/cilium",
                    readOnly: true,
                  },
                  {
                    name: "config",
                    mountPath: "/etc/hubble-relay",
                    readOnly: true,
                  },
                  {
                    name: "tls",
                    mountPath: "/var/lib/hubble-relay/tls",
                    readOnly: true,
                  },
                ],
              },
            ],
            restartPolicy: "Always",
            serviceAccountName: hubbleRelayServiceAccount.name,
            automountServiceAccountToken: false,
            terminationGracePeriodSeconds: 0,
            volumes: [
              {
                name: "config",
                configMap: {
                  name: hubbleRelayConfig.name,
                  items: [
                    {
                      key: "config.yaml",
                      path: "config.yaml",
                    },
                  ],
                },
              },
              {
                name: "hubble-sock-dir",
                hostPath: {
                  path: "/var/run/cilium",
                  type: "Directory",
                },
              },
              {
                name: "tls",
                projected: {
                  defaultMode: 256,
                  sources: [
                    {
                      secret: {
                        name: relaySecret,
                        items: [
                          {
                            key: "ca.crt",
                            path: "hubble-server-ca.crt",
                          },
                          {
                            key: "tls.crt",
                            path: "client.crt",
                          },
                          {
                            key: "tls.key",
                            path: "client.key",
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    new KubeDeployment(this, "uiDeployment", {
      metadata: {
        name: "hubble-ui",
        namespace: namespace,
        labels: hubbleUiLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: hubbleUiLabels,
        },
        template: {
          metadata: {
            labels: hubbleUiLabels,
          },
          spec: {
            securityContext: {
              runAsUser: 1001,
            },
            serviceAccountName: hubbleUIServiceAccount.name,
            containers: [
              {
                name: "frontend",
                image:
                  "quay.io/cilium/hubble-ui:v0.8.5@sha256:4eaca1ec1741043cfba6066a165b3bf251590cf4ac66371c4f63fbed2224ebb4",
                imagePullPolicy: "IfNotPresent",
                ports: [
                  {
                    name: "http",
                    containerPort: 8080,
                  },
                ],
              },
              {
                name: "backend",
                image:
                  "quay.io/cilium/hubble-ui-backend:v0.8.5@sha256:2bce50cf6c32719d072706f7ceccad654bfa907b2745a496da99610776fe31ed",
                imagePullPolicy: "IfNotPresent",
                env: [
                  {
                    name: "EVENTS_SERVER_PORT",
                    value: "8090",
                  },
                  {
                    name: "FLOWS_API_ADDR",
                    value: "hubble-relay:80",
                  },
                ],
                ports: [
                  {
                    name: "grpc",
                    containerPort: 8090,
                  },
                ],
              },
              {
                name: "proxy",
                image:
                  "docker.io/envoyproxy/envoy:v1.18.4@sha256:e5c2bb2870d0e59ce917a5100311813b4ede96ce4eb0c6bfa879e3fbe3e83935",
                imagePullPolicy: "IfNotPresent",
                ports: [
                  {
                    name: "http",
                    containerPort: envoyUiProxyPort,
                  },
                ],
                command: ["envoy"],
                args: ["-c", "/etc/envoy.yaml", "-l", "info"],
                volumeMounts: [
                  {
                    name: "hubble-ui-envoy-yaml",
                    mountPath: "/etc/envoy.yaml",
                    subPath: "envoy.yaml",
                  },
                ],
              },
            ],
            volumes: [
              {
                name: "hubble-ui-envoy-yaml",
                configMap: {
                  name: hubbleUIEnvoyConfig.name,
                },
              },
            ],
          },
        },
      },
    });

    new KubeIngress(this, "hubble-ui-ingress", {
      metadata: {
        name: `${name}-hubble-ui`,
        namespace: namespace,
        labels: labels,
        annotations: {
          "cert-manager.io/cluster-issuer": props.clusterIssuer.name,
          "cert-manager.io/common-name": "hubble.internal.serenacodes.com",
        },
      },
      spec: {
        ingressClassName: "nginx",
        tls: [
          {
            hosts: ["hubble.internal.serenacodes.com"],
            secretName: "hubble-ingress",
          },
        ],
        rules: [
          {
            host: "hubble.internal.serenacodes.com",
            http: {
              paths: [
                {
                  backend: {
                    service: {
                      name: uiService.name,
                      port: {
                        number: envoyUiProxyPort,
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
  }
}
