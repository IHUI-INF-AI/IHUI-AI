// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 容器与编排族(docker / kubectl):二级命令族。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { nestedSpec } from './syntax-options.js';

export const DOCKER_SPEC: CommandSpec = {
  effect: 'write',
  structured: true,
  globalOptions: [opt('H', { arity: 'required' }), opt('D'), opt('config', { arity: 'required' }), opt('context', { arity: 'required' }), opt('host', { arity: 'required' }), opt('log-level', { arity: 'required' }), opt('tlsverify'), opt('tlscacert', { arity: 'required' }), opt('tlscert', { arity: 'required' }), opt('tlskey', { arity: 'required' }), opt('debug'), opt('version'), opt('help')],
  subcommands: {
    ps: { effects: ['read'], options: [opt('a'), opt('l'), opt('n', { arity: 'required' }), opt('q'), opt('all'), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' }), opt('last', { arity: 'required' }), opt('latest'), opt('no-trunc'), opt('quiet'), opt('size')] },
    logs: { effects: ['read'], options: [opt('f'), opt('t'), opt('details'), opt('follow'), opt('since', { arity: 'required' }), opt('tail', { arity: 'required' }), opt('timestamps'), opt('until', { arity: 'required' })] },
    inspect: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('size'), opt('type', { arity: 'required' }), opt('verbose'), opt('go-template', { arity: 'required' })] },
    version: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('short')] },
    info: { effects: ['read'], options: [opt('f', { arity: 'required' }), opt('format', { arity: 'required' }), opt('debug')] },
    images: { effects: ['read'], options: [opt('a'), opt('q'), opt('all'), opt('digests'), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' }), opt('no-trunc'), opt('quiet'), opt('tree')] },
    top: { effects: ['read'], options: [] },
    port: { effects: ['read'], options: [] },
    diff: { effects: ['read'], options: [] },
    events: { effects: ['read'], options: [opt('since', { arity: 'required' }), opt('until', { arity: 'required' }), opt('filter', { arity: 'required' }), opt('format', { arity: 'required' })] },
    wait: { effects: ['read'], options: [opt('p'), opt('condition', { arity: 'required' })] },
    history: { effects: ['read'], options: [opt('q'), opt('no-trunc'), opt('quiet'), opt('format', { arity: 'required' })] },
    stats: { effects: ['read'], options: [opt('a'), opt('no-stream'), opt('all'), opt('no-trunc'), opt('format', { arity: 'required' })] },
    run: {
      effects: ['write', 'network', 'system'],
      options: [
        opt('privileged', { effects: ['destructive', 'system'], alwaysConfirm: true, rule: 'docker run --privileged' }),
        opt('v', { arity: 'required', effects: ['write'] }), opt('volume', { arity: 'required', effects: ['write'] }), opt('mount', { arity: 'required', effects: ['write'] }), opt('device', { arity: 'required', effects: ['write'] }),
        opt('p', { arity: 'required' }), opt('P'), opt('publish', { arity: 'required' }), opt('publish-all'), opt('e', { arity: 'required' }), opt('env', { arity: 'required' }), opt('env-file', { arity: 'required' }),
        opt('d'), opt('i'), opt('it'), opt('t'), opt('rm'), opt('detach'), opt('interactive'), opt('name', { arity: 'required' }), opt('net', { arity: 'required' }), opt('network', { arity: 'required' }), opt('u', { arity: 'required' }), opt('user', { arity: 'required' }), opt('w', { arity: 'required' }), opt('workdir', { arity: 'required' }),
        opt('entrypoint', { arity: 'required' }), opt('add-host', { arity: 'required' }), opt('label', { arity: 'required' }), opt('pid', { arity: 'required' }), opt('ipc', { arity: 'required' }), opt('uts', { arity: 'required' }), opt('security-opt', { arity: 'required' }), opt('cap-add', { arity: 'required' }), opt('cap-drop', { arity: 'required' }), opt('ulimit', { arity: 'required' }), opt('memory', { arity: 'required' }), opt('cpus', { arity: 'required' }), opt('restart', { arity: 'required' }),
      ],
    },
    create: { effects: ['write'], options: [opt('name', { arity: 'required' }), opt('entrypoint', { arity: 'required' }), opt('e', { arity: 'required' }), opt('v', { arity: 'required' }), opt('p', { arity: 'required' })] },
    start: { effects: ['system', 'write'], options: [opt('a'), opt('i'), opt('attach'), opt('interactive'), opt('check', { arity: 'required' })] },
    stop: { effects: ['system', 'write'], options: [opt('t', { arity: 'required' }), opt('time', { arity: 'required' })] },
    restart: { effects: ['system', 'write'], options: [opt('t', { arity: 'required' }), opt('time', { arity: 'required' })] },
    kill: { effects: ['system', 'destructive'], options: [opt('s', { arity: 'required' }), opt('signal', { arity: 'required' })] },
    rm: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('v'), opt('force'), opt('link'), opt('volumes'), opt('no-index')] },
    rmi: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('force'), opt('no-prune')] },
    build: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('t', { arity: 'required' }), opt('file', { arity: 'required' }), opt('tag', { arity: 'required' }), opt('build-arg', { arity: 'required' }), opt('label', { arity: 'required' }), opt('no-cache'), opt('platform', { arity: 'required' }), opt('progress', { arity: 'required' }), opt('pull'), opt('quiet'), opt('secret', { arity: 'required' }), opt('ssh', { arity: 'required' }), opt('target', { arity: 'required' })] },
    pull: { effects: ['write', 'network'], options: [opt('a'), opt('q'), opt('all-tags'), opt('disable-content-trust', { arity: 'optional' }), opt('platform', { arity: 'required' }), opt('quiet')] },
    push: { effects: ['network', 'write'], options: [opt('a'), opt('q'), opt('all-tags'), opt('quiet'), opt('tag', { arity: 'required' })] },
    exec: { effects: ['system', 'write'], options: [opt('i'), opt('it'), opt('t'), opt('d'), opt('u', { arity: 'required' }), opt('w', { arity: 'required' }), opt('e', { arity: 'required' }), opt('env', { arity: 'required' }), opt('privileged', { effects: ['destructive'], alwaysConfirm: true }), opt('user', { arity: 'required' }), opt('workdir', { arity: 'required' }), opt('detach-keys', { arity: 'required' })] },
    cp: { effects: ['write'], options: [opt('a'), opt('L'), opt('archive'), opt('follow-likelihood')] },
    tag: { effects: ['write'], options: [] },
    save: { effects: ['write'], options: [opt('o', { arity: 'required' }), opt('output', { arity: 'required' })] },
    load: { effects: ['write'], options: [opt('i', { arity: 'required' }), opt('q'), opt('input', { arity: 'required' }), opt('quiet')] },
    import: { effects: ['write'], options: [opt('c', { arity: 'required' }), opt('m', { arity: 'required' }), opt('change', { arity: 'required' }), opt('message', { arity: 'required' })] },
    export: { effects: ['write'], options: [opt('o', { arity: 'required' })] },
    login: { effects: ['network', 'write'], options: [opt('p', { arity: 'required' }), opt('u', { arity: 'required' }), opt('password', { arity: 'required' }), opt('password-stdin'), opt('username', { arity: 'required' })] },
    logout: { effects: ['write'], options: [] },
    attach: { effects: ['system'], options: [opt('no-stdin'), opt('sig-keys', { arity: 'required' })] },
    commit: { effects: ['write'], options: [opt('a'), opt('c', { arity: 'required' }), opt('m', { arity: 'required' }), opt('author', { arity: 'required' }), opt('change', { arity: 'required' }), opt('message', { arity: 'required' })] },
    compose: nestedSpec(['up', 'down', 'build', 'restart', 'kill', 'rm', 'create', 'pull', 'push', 'stop', 'run'], [opt('f', { arity: 'required' }), opt('file', { arity: 'required' }), opt('env-file', { arity: 'required' }), opt('profile', { arity: 'required' })]),
    container: nestedSpec(['run', 'create', 'remove', 'rm', 'start', 'stop', 'restart', 'kill', 'cp', 'commit', 'update', 'prune', 'pause', 'unpause']),
    image: nestedSpec(['build', 'pull', 'push', 'rm', 'remove', 'tag', 'save', 'load', 'import', 'prune']),
    volume: nestedSpec(['create', 'rm', 'remove', 'prune']),
    network: nestedSpec(['create', 'rm', 'remove', 'connect', 'disconnect', 'prune']),
    builder: nestedSpec(['prune', 'build', 'discard'], [opt('a'), opt('ff', { arity: 'required' }), opt('keep-duration', { arity: 'required' }), opt('filter', { arity: 'required' })]),
    system: nestedSpec(['prune', 'df'], [opt('a'), opt('all'), opt('volumes'), opt('force'), opt('filter', { arity: 'required' })]),
    node: nestedSpec(['demote', 'promote', 'update']),
    plugin: nestedSpec(['install', 'enable', 'disable', 'rm', 'remove', 'set', 'upgrade', 'push', 'create', 'configure']),
    secret: nestedSpec(['create', 'rm', 'remove']),
    config: nestedSpec(['create', 'rm', 'remove']),
    stack: nestedSpec(['deploy', 'rm', 'remove', 'up', 'down']),
    service: nestedSpec(['create', 'update', 'rm', 'remove', 'scale']),
    swarm: nestedSpec(['init', 'join', 'leave', 'update']),
    trust: nestedSpec(['sign', 'revoke']),
    manifest: nestedSpec(['create', 'annotate', 'rm', 'remove', 'push', 'inspect', 'rm']),
  },
};

export const KUBECTL_SPEC: CommandSpec = {
  effect: 'write',
  structured: true,
  globalOptions: [
    opt('A'), opt('a'), opt('n', { arity: 'required' }), opt('N', { arity: 'required' }), opt('all-namespaces'), opt('as', { arity: 'required' }), opt('as-group', { arity: 'required' }), opt('cache-dir', { arity: 'required' }), opt('certificate-authority', { arity: 'required' }), opt('client'), opt('cluster', { arity: 'required' }), opt('context', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('insecure-skip-tls-verify'), opt('kubeconfig', { arity: 'required' }), opt('log-file', { arity: 'required', effects: ['write'] }), opt('log-flush-frequency', { arity: 'required' }), opt('log-level', { arity: 'required' }), opt('namespace', { arity: 'required' }), opt('profile', { arity: 'required' }), opt('profile-output', { arity: 'required' }), opt('request-timeout', { arity: 'required' }), opt('server', { arity: 'required' }), opt('skip-headers'), opt('token', { arity: 'required' }), opt('user', { arity: 'required' }), opt('v', { arity: 'required' }), opt('verbosity', { arity: 'required' }), opt('warn-only'),
  ],
  subcommands: {
    get: { effects: ['read'], options: [opt('A'), opt('a'), opt('o', { arity: 'required' }), opt('w'), opt('allow-missing-template-keys'), opt('all-namespaces'), opt('chunk-size', { arity: 'required' }), opt('field-selector', { arity: 'required' }), opt('ignore-not-found'), opt('l', { arity: 'required' }), opt('no-headers'), opt('output', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('server-print'), opt('show-kind'), opt('show-labels'), opt('show-managed-fields'), opt('sort-by', { arity: 'required' }), opt('template', { arity: 'required' }), opt('watch'), opt('watch-only')] },
    describe: { effects: ['read'], options: [opt('s'), opt('A'), opt('all-namespaces'), opt('filename', { arity: 'required' }), opt('l', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('show-events'), opt('show-labels')] },
    explain: { effects: ['read'], options: [opt('api-version', { arity: 'required' }), opt('recursive')] },
    logs: { effects: ['read'], options: [opt('c', { arity: 'required' }), opt('f'), opt('p'), opt('prefix'), opt('timestamps'), opt('all-containers'), opt('container', { arity: 'required' }), opt('ignore-errors'), opt('insecure-skip-tls-verify-backend'), opt('l', { arity: 'required' }), opt('max-log-bytes', { arity: 'required' }), opt('previous'), opt('selector', { arity: 'required' }), opt('since', { arity: 'required' }), opt('since-time', { arity: 'required' }), opt('tail', { arity: 'required' })] },
    top: { effects: ['read'], options: [opt('no-headers'), opt('containers'), opt('sort-by', { arity: 'required' })] },
    version: { effects: ['read'], options: [opt('o', { arity: 'required' }), opt('short'), opt('output', { arity: 'required' })] },
    'api-resources': { effects: ['read'], options: [opt('api-group', { arity: 'required' }), opt('cached'), opt('namespaced'), opt('output', { arity: 'required' }), opt('verbs')] },
    'api-versions': { effects: ['read'], options: [] },
    diff: { effects: ['read', 'network'], options: [opt('f', { arity: 'required' }), opt('R'), opt('filename', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('recursive'), opt('server-side')] },
    auth: { effects: ['read', 'network'], options: [opt('canonical'), opt('silent')] },
    completion: { effects: ['read'], options: [opt('no-descriptions')] },
    wait: { effects: ['read', 'network'], options: [opt('a'), opt('all'), opt('for', { arity: 'required' }), opt('overwrite'), opt('timeout', { arity: 'required' })] },
    apply: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('l', { arity: 'required' }), opt('R'), opt('filename', { arity: 'required' }), opt('force-conflicts'), opt('field-manager', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('record'), opt('recursive'), opt('server-side')] },
    delete: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('a'), opt('all'), opt('f', { arity: 'required' }), opt('l', { arity: 'required' }), opt('now'), opt('wait'), opt('all-local'), opt('cascade', { arity: 'required' }), opt('field-manager', { arity: 'required' }), opt('field-selector', { arity: 'required' }), opt('force'), opt('grace-period', { arity: 'required' }), opt('ignore-not-found'), opt('keep-phase', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    'delete-collection': { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('field-selector', { arity: 'required' }), opt('timeout', { arity: 'required' }), opt('grace-period', { arity: 'required' })] },
    create: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('R'), opt('allow-missing-template-keys'), opt('filename', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('record'), opt('recursive'), opt('validate')] },
    replace: { effects: ['write', 'destructive'], options: [opt('f', { arity: 'required' }), opt('F', { arity: 'required' }), opt('force'), opt('filename', { arity: 'required' }), opt('grace-period', { arity: 'required' }), opt('o', { arity: 'required' })] },
    patch: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('p', { arity: 'required' }), opt('type', { arity: 'required' }), opt('allow-missing-template-keys'), opt('dry-run', { arity: 'optional' }), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('local'), opt('no-headers'), opt('overwrite'), opt('patch', { arity: 'required' }), opt('record')] },
    scale: { effects: ['write', 'network'], options: [opt('r', { arity: 'required' }), opt('allow-missing-template-keys'), opt('current-replicas', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('filename', { arity: 'required' }), opt('o', { arity: 'required' }), opt('replicas', { arity: 'required' }), opt('resource-version', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    rollout: nestedSpec(['undo', 'pause', 'resume', 'restart', 'history'], [opt('w'), opt('to-revision', { arity: 'required' }), opt('watch'), opt('watch=false'), opt('timeout', { arity: 'required' }), opt('revision', { arity: 'required' }), opt('dry-run', { arity: 'optional' })]),
    label: { effects: ['write', 'network'], options: [opt('l', { arity: 'required' }), opt('list'), opt('all'), opt('allow-missing-template-keys'), opt('dry-run', { arity: 'optional' }), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('local'), opt('overwrite'), opt('resource-version', { arity: 'required' }), opt('selector', { arity: 'required' })] },
    annotate: { effects: ['write', 'network'], options: [opt('l', { arity: 'required' }), opt('list'), opt('field-manager', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('overwrite'), opt('local')] },
    taint: { effects: ['write', 'network'], options: [opt('all'), opt('overwrite'), opt('allow-missing-template-keys'), opt('field-manager', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('resource-version', { arity: 'required' })] },
    cordon: { effects: ['write', 'network'], options: [opt('dry-run', { arity: 'optional' })] },
    uncordon: { effects: ['write', 'network'], options: [opt('dry-run', { arity: 'optional' })] },
    drain: { effects: ['write', 'destructive'], alwaysConfirm: true, options: [opt('f'), opt('force'), opt('grace-period', { arity: 'required' }), opt('ignore-daemonsets'), opt('delete-emptydir-data'), opt('disable-eviction'), opt('pod-selector', { arity: 'required' }), opt('skip-wait-for-delete-timeout', { arity: 'required' }), opt('timeout', { arity: 'required' })] },
    exec: { effects: ['system', 'network'], options: [opt('c', { arity: 'required' }), opt('i'), opt('p'), opt('q'), opt('t'), opt('container', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('pod-running-timeout', { arity: 'required' }), opt('stdin'), opt('stdout'), opt('quiet')] },
    'port-forward': { effects: ['network', 'system'], options: [opt('address', { arity: 'required' }), opt('arguments'), opt('env-var', { arity: 'required' }), opt('pod-running-timeout', { arity: 'required' })] },
    attach: { effects: ['system'], options: [opt('c', { arity: 'required' }), opt('i'), opt('q'), opt('t'), opt('container', { arity: 'required' }), opt('quiet')] },
    run: { effects: ['write', 'network', 'system'], options: [opt('i'), opt('it'), opt('rm'), opt('t'), opt('allow-missing-template-keys'), opt('attach'), opt('command'), opt('dry-run', { arity: 'optional' }), opt('env', { arity: 'required' }), opt('expose'), opt('image', { arity: 'required' }), opt('labels', { arity: 'required' }), opt('overrides', { arity: 'required' }), opt('port', { arity: 'required' }), opt('restart', { arity: 'required' }), opt('serviceaccount', { arity: 'required' })] },
    expose: { effects: ['write', 'network'], options: [opt('f', { arity: 'required' }), opt('name', { arity: 'required' }), opt('protocol', { arity: 'required' }), opt('dry-run', { arity: 'optional' }), opt('external-ip', { arity: 'required' }), opt('filename', { arity: 'required' }), opt('load-balancer-ip', { arity: 'required' }), opt('o', { arity: 'required' }), opt('port', { arity: 'required' }), opt('selector', { arity: 'required' }), opt('target-port', { arity: 'required' }), opt('type', { arity: 'required' })] },
    proxy: { effects: ['network', 'system'], options: [opt('address', { arity: 'required' }), opt('port', { arity: 'required' })] },
    config: {
      readGuardOptions: ['view', 'current-context', 'get-contexts', 'describe'],
      mutatingOperands: ['set-context', 'use-context', 'set-credentials', 'delete-context', 'unset', 'rename-context', 'set', 'set-cluster'],
      options: [opt('o', { arity: 'required' }), opt('output', { arity: 'required' }), opt('flatten'), opt('minify'), opt('raw-bytes')],
    },
  },
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
