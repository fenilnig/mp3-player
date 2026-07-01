document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('vis-3d-btn');
    if(!btn) return;
    
    let isActive = false;
    let scene, camera, renderer, coreMesh, particles, wireframeMesh;
    let container;
    let animationId = null;
    let coreGeometry;
    let originalVertices = [];

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
    container.style.pointerEvents = 'none'; 
    container.style.background = '#020202'; 
    document.body.insertBefore(container, document.body.firstChild);

    function initThree() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020202, 0.002);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 100);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        container.appendChild(renderer.domElement);

        // Core Sphere (Icosahedron)
        coreGeometry = new THREE.IcosahedronGeometry(30, 2);
        
        // Store original vertices for audio displacement
        const positions = coreGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            originalVertices.push(new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)));
        }

        const coreMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x222222,
            shininess: 100,
            flatShading: true,
            transparent: true,
            opacity: 0.9
        });
        
        coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        
        // Wireframe overlay for the core
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });
        wireframeMesh = new THREE.Mesh(coreGeometry, wireframeMaterial);
        coreMesh.add(wireframeMesh);
        
        scene.add(coreMesh);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffffff, 1, 300);
        pointLight1.position.set(50, 50, 50);
        scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 300);
        pointLight2.position.set(-50, -50, -50);
        scene.add(pointLight2);

        // Particles (Starfield)
        const particleGeo = new THREE.BufferGeometry();
        const particleCount = 1500;
        const posArray = new Float32Array(particleCount * 3);
        for(let i=0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 400;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({
            size: 1.5,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        particles = new THREE.Points(particleGeo, particleMat);
        scene.add(particles);

        window.addEventListener('resize', onWindowResize);
    }

    function onWindowResize() {
        if (!camera || !renderer || !isActive) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        if (!isActive) return;
        animationId = requestAnimationFrame(animate);

        // Update colors based on current theme accent
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
        if (coreMesh && accentHex) {
            let color = new THREE.Color();
            if (accentHex.startsWith('rgb')) {
                const rgb = accentHex.match(/\d+/g);
                if (rgb && rgb.length === 3) {
                    color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
                }
            } else if (accentHex.startsWith('#')) {
                color.set(accentHex);
            }
            
            coreMesh.material.emissive = color.clone().multiplyScalar(0.4);
            wireframeMesh.material.color = color;
            particles.material.color = color;
        }

        // Audio reactivity
        let bass = 0, mids = 0;
        if (window.analyserNode) {
            const dataArray = new Uint8Array(window.analyserNode.frequencyBinCount);
            window.analyserNode.getByteFrequencyData(dataArray);

            for(let i=0; i<10; i++) bass += dataArray[i];
            bass /= 10;
            
            for(let i=10; i<50; i++) mids += dataArray[i];
            mids /= 40;

            const positions = coreGeometry.attributes.position;
            const time = Date.now() * 0.002;
            
            // Deform sphere vertices based on audio
            for (let i = 0; i < positions.count; i++) {
                const orig = originalVertices[i];
                // Math.sin adds a nice ripple effect over time
                const displacement = ((bass / 255) * 15) + (Math.sin(time + orig.x * 0.1) * (mids / 255) * 5);
                
                const dir = orig.clone().normalize();
                const newPos = orig.clone().add(dir.multiplyScalar(displacement));
                
                positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
            }
            positions.needsUpdate = true;
            coreGeometry.computeVertexNormals(); // Recalculate lighting normals
            
            // Rotate based on bass
            coreMesh.rotation.y += 0.002 + (bass / 255.0) * 0.05;
            coreMesh.rotation.x += 0.001 + (mids / 255.0) * 0.02;
            
            particles.rotation.y -= 0.001 + (bass / 255.0) * 0.01;
        } else {
            // Default idle animation
            coreMesh.rotation.y += 0.002;
            coreMesh.rotation.x += 0.001;
            particles.rotation.y -= 0.001;
        }

        renderer.render(scene, camera);
    }

    btn.addEventListener('click', () => {
        isActive = !isActive;
        
        if (isActive) {
            btn.style.color = 'var(--accent-color)';
            container.style.display = 'block';
            document.body.classList.add('mode-3d-active');
            
            if (!scene) initThree();
            // Start loop
            if (animationId) cancelAnimationFrame(animationId);
            animate();
        } else {
            // Clean stop
            isActive = false;
            btn.style.color = '';
            document.body.classList.remove('mode-3d-active');
            container.style.display = 'none';
            
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    });
});
