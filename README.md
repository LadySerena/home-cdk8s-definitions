# home-cdk8s-definitions

Repo to play with cdk8s in my homelab.

## Bootstrap

1. create the secret with cloud dns admin perms (needed for the dns01 challenges)
    1.
   ```yaml
    apiVersion: v1
    data: 
      key.json: <gcp serviceaccount key with dns admin perms>
    kind: Secret
    metadata:
      name: cloud-dns01-key
      namespace: cert-manager
    type: Opaque
    ```
2. set the bootstrap flag in [main.ts](./main.ts) for cilium to `true`. This will disable hubble allowing CNI to come up
   before cert-manager
3. `npm run compile && npm run synth`
4. `kubectl create -f dist/0000-cert-manager-crds.k8s.yaml`
5. `kubectl apply -f dist/0001-cilium.k8s.yaml`
6. wait for CNI to come up
7. `kubectl apply -f dist/0002-cert-manager.k8s.yaml`
8. note you might have to reapply cert manager because its internal CA needs to be injected prior to usage
9. with cert manager running flip the bootstrap flag to false for cilium
10. `npm run compile && npm run synth`
11. `kubectl apply -f dist/0001-cilium.k8s.yaml`
12. run stuff!

## TODOs

- setup gcp workload identity federation because static creds isn't the best
    - https://github.com/salrashid123/k8s_federation_with_gcp