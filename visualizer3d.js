document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('vis-3d-btn');
    let isActive = false;
    let scene, camera, renderer, terrain, particles;
    let container;
    let animationId;

    // Create container
    container = document.createElement('div');
    container.id = 'visualizer-3d-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '1'; 
    container.style.display = 'none';
    container.style.pointerEvents = 'none'; // let clicks pass through
    container.style.background = '#050505'; // dark background
    document.body.insertBefore(container, document.body.firstChild);

    // Make app-container sit above it
    const appContainer = document.querySelector('.app-container');

    function initThree() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, 0.002);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 50, 150);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Terrain
        const geometry = new THREE.PlaneGeometry(800, 800, 64, 64);
        // Rotate flat
        geometry.rotateX(-Math.PI / 2);
        
        // Save initial Y positions
        const positionAttribute = geometry.attributes.position;
        geometry.userData = { initialY: [] };
        for (let i = 0; i < positionAttribute.count; i++) {
            geometry.userData.initialY.push(positionAttribute.getY(i));
        }

        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        terrain = new THREE.Mesh(geometry, material);
        scene.add(terrain);

        // Particles
        const particleGeo = new THREE.BufferGeometry();
        const particleCount = 1000;
        const posArray = new Float32Array(particleCount * 3);
        for(let i=0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 600;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({
            size: 2,
            color: 0xff00ff,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        particles = new THREE.Points(particleGeo, particleMat);
        scene.add(particles);

        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        if (!isActive) return;
        animationId = requestAnimationFrame(animate);

        // Update colors based on current theme accent
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
        if (terrain && accentHex) {
            if (accentHex.startsWith('rgb')) {
                const rgb = accentHex.match(/\d+/g);
                if (rgb && rgb.length === 3) {
                    terrain.material.color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
                    particles.material.color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
                }
            } else if (accentHex.startsWith('#')) {
                terrain.material.color.set(accentHex);
                particles.material.color.set(accentHex);
            }
        }

        // Audio reactivity
        if (window.analyserNode) {
            const dataArray = new Uint8Array(window.analyserNode.frequencyBinCount);
            window.analyserNode.getByteFrequencyData(dataArray);

            // Average low frequencies (bass)
            let bass = 0;
            for(let i=0; i<10; i++) bass += dataArray[i];
            bass /= 10;

            // Move terrain vertices
            const positionAttribute = terrain.geometry.attributes.position;
            const initials = terrain.geometry.userData.initialY;
            
            for (let i = 0; i < positionAttribute.count; i++) {
                const x = positionAttribute.getX(i);
                const z = positionAttribute.getZ(i);
                const dist = Math.sqrt(x*x + z*z);
                
                const bin = Math.floor(dist / 4);
                let val = 0;
                if (bin < dataArray.length) {
                    val = dataArray[bin] / 255.0; 
                }

                const time = Date.now() * 0.002;
                const wave = Math.sin(dist * 0.05 - time) * 10;
                
                positionAttribute.setY(i, initials[i] + wave + (val * 40));
            }
            positionAttribute.needsUpdate = true;
            
            particles.rotation.y += 0.002 + (bass / 255.0) * 0.02;
            particles.rotation.x += 0.001;
        } else {
            const time = Date.now() * 0.001;
            const positionAttribute = terrain.geometry.attributes.position;
            const initials = terrain.geometry.userData.initialY;
            for (let i = 0; i < positionAttribute.count; i++) {
                const x = positionAttribute.getX(i);
                const z = positionAttribute.getZ(i);
                const dist = Math.sqrt(x*x + z*z);
                const wave = Math.sin(dist * 0.05 - time) * 15;
                positionAttribute.setY(i, initials[i] + wave);
            }
            positionAttribute.needsUpdate = true;
            particles.rotation.y += 0.002;
        }

        renderer.render(scene, camera);
    }

    btn.addEventListener('click', () => {
        isActive = !isActive;
        if (isActive) {
            btn.style.color = 'var(--accent-color)';
            container.style.display = 'block';
            
            // Make player translucent so we can see the 3D background
            appContainer.style.background = 'rgba(0,0,0,0.3)';
            appContainer.style.backdropFilter = 'blur(10px)';
            appContainer.style.zIndex = '10';

            if (!scene) initThree();
            animate();
        } else {
            btn.style.color = '';
            container.style.display = 'none';
            appContainer.style.background = '';
            appContainer.style.backdropFilter = '';
            if (animationId) cancelAnimationFrame(animationId);
        }
    });
});
