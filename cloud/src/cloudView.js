// 구름 · 캐릭터 · 동전 · 깃발.
import * as THREE from "three";
import { PLAYER_HEIGHT } from "../../common/parts/platform3d.js";

const CLOUD_HEIGHT = 0.34;

export function createCloudView(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const clouds = new THREE.Group();
  const coins = new THREE.Group();
  const character = new THREE.Group();
  root.add(clouds, coins, character);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x5ac8fa, roughness: 0.45, metalness: 0.1 }),
  );
  body.position.y = 0.21;
  body.castShadow = true;
  character.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.22, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd9f2ff, roughness: 0.4, metalness: 0.08 }),
  );
  head.position.y = 0.53;
  head.castShadow = true;
  character.add(head);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x16202c, roughness: 0.3 }),
    );
    eye.position.set(side * 0.07, 0.55, 0.16);
    character.add(eye);
  }

  let level = null;
  let coinMeshes = [];

  function clearGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse?.((object) => {
        if (object.geometry) object.geometry.dispose();
        const material = object.material;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) entry.dispose();
      });
    }
  }

  function setLevel(next) {
    level = next;
    clearGroup(clouds);
    clearGroup(coins);
    coinMeshes = [];

    for (const platform of next.platforms) {
      const puff = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(platform.halfWidth * 2, CLOUD_HEIGHT, platform.halfDepth * 2),
        new THREE.MeshStandardMaterial({ color: 0xf3f7fb, roughness: 0.95, metalness: 0 }),
      );
      base.position.set(platform.x, platform.top - CLOUD_HEIGHT / 2, platform.z ?? 0);
      base.receiveShadow = true;
      base.castShadow = true;
      puff.add(base);

      const bumps = Math.max(2, Math.round(platform.halfWidth * 3));
      for (let i = 0; i < bumps; i += 1) {
        const radius = 0.16 + (i % 3) * 0.04;
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 14, 12),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0 }),
        );
        ball.position.set(
          platform.x - platform.halfWidth + ((i + 0.5) / bumps) * platform.halfWidth * 2,
          platform.top - 0.04 + (i % 2) * 0.03,
          (platform.z ?? 0) + (i % 2 === 0 ? -0.16 : 0.16),
        );
        ball.castShadow = true;
        puff.add(ball);
      }
      clouds.add(puff);
    }

    next.coins.forEach((coin, index) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20),
        new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.3, metalness: 0.6 }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(coin.x, coin.y, coin.z);
      mesh.castShadow = true;
      mesh.userData = { index };
      coins.add(mesh);
      coinMeshes.push(mesh);
    });

    // 깃발.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a94a3, roughness: 0.5, metalness: 0.3 }),
    );
    pole.position.set(next.goal.x, next.goal.y - 0.75, next.goal.z);
    pole.castShadow = true;
    root.add(pole);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xff6b5c, side: THREE.DoubleSide, roughness: 0.7 }),
    );
    flag.position.set(next.goal.x + 0.26, next.goal.y + 0.2, next.goal.z);
    root.add(flag);
  }

  function setPlayer(player, running) {
    character.position.set(player.x, player.y, player.z);
    character.rotation.y = player.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    const bob = running ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0;
    body.position.y = 0.21 + bob;
    head.position.y = 0.53 + bob;
  }

  function setCoins(collected) {
    coinMeshes.forEach((mesh, index) => {
      mesh.visible = !collected.has(index);
      mesh.rotation.y = performance.now() * 0.002;
    });
  }

  return {
    root,
    setLevel,
    setPlayer,
    setCoins,
    get character() {
      return character;
    },
    get height() {
      return PLAYER_HEIGHT;
    },
  };
}
