import { Construct } from "constructs";
import { KubeClusterRole, KubeConfigMap, KubeIngress, KubeServiceAccount } from "../imports/k8s";
import { StandardLabels } from "./standardLabels";
import { readVerbs } from "./Constants";

export class Cilium extends Construct {
  constructor(scope: Construct, id: string) {
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

    // the helm chart references secrets and i don't want to commit those so that's a TODO

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

    const hubbleUIEnvoyConfig = new KubeConfigMap(this, "hubble-ui-envoy-config", {
      metadata: {
        name: "hubble-ui-envoy",
        namespace: namespace,
        labels: labels,
      },
      data: {
        "envoy.yaml":
          'static_resources:\n  listeners:\n    - name: listener_hubble_ui\n      address:\n        socket_address:\n          address: 0.0.0.0\n          port_value: 8081\n      filter_chains:\n        - filters:\n            - name: envoy.filters.network.http_connection_manager\n              typed_config:\n                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager\n                codec_type: auto\n                stat_prefix: ingress_http\n                route_config:\n                  name: local_route\n                  virtual_hosts:\n                    - name: local_service\n                      domains: ["*"]\n                      routes:\n                        - match:\n                            prefix: "/api/"\n                          route:\n                            cluster: backend\n                            prefix_rewrite: "/"\n                            timeout: 0s\n                            max_stream_duration:\n                              grpc_timeout_header_max: 0s\n                        - match:\n                            prefix: "/"\n                          route:\n                            cluster: frontend\n                      cors:\n                        allow_origin_string_match:\n                          - prefix: "*"\n                        allow_methods: GET, PUT, DELETE, POST, OPTIONS\n                        allow_headers: keep-alive,user-agent,cache-control,content-type,content-transfer-encoding,x-accept-content-transfer-encoding,x-accept-response-streaming,x-user-agent,x-grpc-web,grpc-timeout\n                        max_age: "1728000"\n                        expose_headers: grpc-status,grpc-message\n                http_filters:\n                  - name: envoy.filters.http.grpc_web\n                  - name: envoy.filters.http.cors\n                  - name: envoy.filters.http.router\n  clusters:\n    - name: frontend\n      connect_timeout: 0.25s\n      type: strict_dns\n      lb_policy: round_robin\n      load_assignment:\n        cluster_name: frontend\n        endpoints:\n          - lb_endpoints:\n              - endpoint:\n                  address:\n                    socket_address:\n                      address: 127.0.0.1\n                      port_value: 8080\n    - name: backend\n      connect_timeout: 0.25s\n      type: logical_dns\n      lb_policy: round_robin\n      http2_protocol_options: {}\n      load_assignment:\n        cluster_name: backend\n        endpoints:\n          - lb_endpoints:\n              - endpoint:\n                  address:\n                    socket_address:\n                      address: 127.0.0.1\n                      port_value: 8090\n',
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

    new KubeIngress(this, "hubble-ui-ingress", {
      metadata: {
        name: `${name}-hubble-ui`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        ingressClassName: "nginx",
        rules: [
          {
            host: "hubble.internal.serenacodes.com",
            http: {
              paths: [
                {
                  backend: {
                    service: {
                      name: "hubble-ui",
                      port: {
                        number: 8081,
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
