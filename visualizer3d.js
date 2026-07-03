document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('vis-3d-btn');
    const visControls = document.getElementById('vis-controls');
    if(!btn || !visControls) return;
    
    let isActive = false;
    let currentStyle = 'sphere';
    let scene, camera, renderer, particles;
    let container;
    let animationId = null;

    // Sphere Mode
    let coreMesh, wireframeMesh, coreGeometry;
    let originalVertices = [];

    // Bars Mode
    let barsGroup;
    let bars = [];
    const NUM_BARS = 64;

    // Waves Mode
    let waveMesh, waveGeometry;
    let waveOriginalY = [];

    // Interaction
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraAngle = { x: 0, y: 0 };
    let targetCameraAngle = { x: 0, y: 0 };
    let cameraDistance = 100;
    let targetCameraDistance = 100;
    let autoRotate = true;

    // Create container
    container = document.createElement('div');
    container.id = 'visualizer-3d-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.zIndex = '0'; 
    container.style.display = 'none';
    container.style.background = '#020202'; 
    document.body.insertBefore(container, document.body.firstChild);

    // Mouse interactivity for dragging and scrolling
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        autoRotate = false;
        previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });
    container.addEventListener('mousemove', (e) => {
        if(isDragging) {
            const deltaMove = {
                x: e.offsetX - previousMousePosition.x,
                y: e.offsetY - previousMousePosition.y
            };
            targetCameraAngle.x -= deltaMove.x * 0.01;
            targetCameraAngle.y -= deltaMove.y * 0.01;
            
            // Limit vertical rotation
            targetCameraAngle.y = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, targetCameraAngle.y));
            
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    container.addEventListener('wheel', (e) => {
        targetCameraDistance += e.deltaY * 0.1;
        targetCameraDistance = Math.max(30, Math.min(300, targetCameraDistance));
    });

    // UI Buttons
    document.getElementById('vis-exit').addEventListener('click', () => {
        btn.click(); // Toggle off
    });
    
    document.getElementById('vis-playpause').addEventListener('click', () => {
        document.getElementById('play-btn').click();
    });
    
    document.getElementById('vis-next').addEventListener('click', () => {
        document.getElementById('next-btn').click();
    });
    
    document.getElementById('vis-prev').addEventListener('click', () => {
        document.getElementById('prev-btn').click();
    });
    
    document.getElementById('vis-style-selector').addEventListener('change', (e) => {
        currentStyle = e.target.value;
        updateVisibility();
        // Reset camera based on mode
        if(currentStyle === 'waves') {
            targetCameraAngle.x = 0;
            targetCameraAngle.y = Math.PI / 4;
            targetCameraDistance = 150;
        } else {
            targetCameraAngle.x = 0;
            targetCameraAngle.y = 0;
            targetCameraDistance = 100;
        }
        autoRotate = true;
    });

    function initThree() {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020202, 0.002);

        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        container.appendChild(renderer.domElement);

        // --- 1. SPHERE MODE ---
        coreGeometry = new THREE.IcosahedronGeometry(30, 2);
        const positions = coreGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            originalVertices.push(new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)));
        }
        const coreMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff, emissive: 0x222222, shininess: 100, flatShading: true, transparent: true, opacity: 0.9
        });
        coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, wireframe: true, transparent: true, opacity: 0.2
        });
        wireframeMesh = new THREE.Mesh(coreGeometry, wireframeMaterial);
        coreMesh.add(wireframeMesh);
        scene.add(coreMesh);

        // --- 2. BARS MODE ---
        barsGroup = new THREE.Group();
        const barGeo = new THREE.BoxGeometry(2, 2, 2);
        const barMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x222222, shininess: 100 });
        for(let i=0; i<NUM_BARS; i++) {
            const mesh = new THREE.Mesh(barGeo, barMat);
            const angle = (i / NUM_BARS) * Math.PI * 2;
            const radius = 40;
            mesh.position.x = Math.cos(angle) * radius;
            mesh.position.z = Math.sin(angle) * radius;
            mesh.lookAt(0,0,0);
            barsGroup.add(mesh);
            bars.push(mesh);
        }
        scene.add(barsGroup);

        // --- 3. WAVES MODE ---
        waveGeometry = new THREE.PlaneGeometry(200, 200, 32, 32);
        waveGeometry.rotateX(-Math.PI / 2);
        const wavePositions = waveGeometry.attributes.position;
        for (let i = 0; i < wavePositions.count; i++) {
            waveOriginalY.push(wavePositions.getY(i));
        }
        const waveMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 });
        waveMesh = new THREE.Mesh(waveGeometry, waveMat);
        waveMesh.position.y = -20;
        scene.add(waveMesh);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xffffff, 1, 300);
        pointLight1.position.set(50, 50, 50);
        scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xffffff, 0.5, 300);
        pointLight2.position.set(-50, -50, -50);
        scene.add(pointLight2);

        // Particles
        const particleGeo = new THREE.BufferGeometry();
        const particleCount = 1500;
        const posArray = new Float32Array(particleCount * 3);
        for(let i=0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 400;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({
            size: 1.5, color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
        });
        particles = new THREE.Points(particleGeo, particleMat);
        scene.add(particles);

        window.addEventListener('resize', onWindowResize);
        updateVisibility();
    }

    function updateVisibility() {
        if(!scene) return;
        coreMesh.visible = (currentStyle === 'sphere');
        barsGroup.visible = (currentStyle === 'bars');
        waveMesh.visible = (currentStyle === 'waves');
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

        // Smooth camera movement
        cameraAngle.x += (targetCameraAngle.x - cameraAngle.x) * 0.1;
        cameraAngle.y += (targetCameraAngle.y - cameraAngle.y) * 0.1;
        cameraDistance += (targetCameraDistance - cameraDistance) * 0.1;

        camera.position.x = Math.sin(cameraAngle.x) * Math.cos(cameraAngle.y) * cameraDistance;
        camera.position.y = Math.sin(cameraAngle.y) * cameraDistance;
        camera.position.z = Math.cos(cameraAngle.x) * Math.cos(cameraAngle.y) * cameraDistance;
        camera.lookAt(scene.position);

        // Theme colors
        const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
        let color = new THREE.Color(0xffffff);
        if (accentHex) {
            if (accentHex.startsWith('rgb')) {
                const rgb = accentHex.match(/\d+/g);
                if (rgb && rgb.length === 3) color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
            } else if (accentHex.startsWith('#')) {
                color.set(accentHex);
            }
        }
        
        particles.material.color = color;
        
        if(currentStyle === 'sphere') {
            coreMesh.material.emissive = color.clone().multiplyScalar(0.5);
            wireframeMesh.material.color = color;
        } else if(currentStyle === 'bars') {
            bars.forEach(b => b.material.emissive = color.clone().multiplyScalar(0.5));
        } else if(currentStyle === 'waves') {
            waveMesh.material.color = color;
        }

        // Audio reactivity
        let bass = 0, mids = 0, highs = 0;
        let dataArray = null;
        
        if (window.analyserNode) {
            dataArray = new Uint8Array(window.analyserNode.frequencyBinCount);
            window.analyserNode.getByteFrequencyData(dataArray);

            for(let i=0; i<8; i++) bass += dataArray[i];
            bass /= 8;
            for(let i=8; i<40; i++) mids += dataArray[i];
            mids /= 32;
            for(let i=40; i<100; i++) highs += dataArray[i];
            highs /= 60;
        }

        const time = Date.now() * 0.002;

        if(currentStyle === 'sphere') {
            if (dataArray) {
                const positions = coreGeometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const orig = originalVertices[i];
                    const displacement = ((bass / 255) * 18) + (Math.sin(time + orig.x * 0.1) * (mids / 255) * 8);
                    const dir = orig.clone().normalize();
                    const newPos = orig.clone().add(dir.multiplyScalar(displacement));
                    positions.setXYZ(i, newPos.x, newPos.y, newPos.z);
                }
                positions.needsUpdate = true;
                coreGeometry.computeVertexNormals();
                
                const scaleBurst = 1 + (highs / 255.0) * 0.15;
                coreMesh.scale.set(scaleBurst, scaleBurst, scaleBurst);
                
                coreMesh.rotation.y += 0.002 + (bass / 255.0) * 0.05;
                coreMesh.rotation.x += 0.001 + (mids / 255.0) * 0.02;
            } else {
                coreMesh.rotation.y += 0.002;
                coreMesh.rotation.x += 0.001;
            }
        } 
        else if (currentStyle === 'bars') {
            if (dataArray) {
                if(autoRotate) targetCameraAngle.x += 0.005 + (bass/255.0)*0.01;
                
                for(let i=0; i<NUM_BARS; i++) {
                    // Map bar index to frequency bin
                    const bin = Math.floor((i / NUM_BARS) * 60); 
                    const val = dataArray[bin] / 255.0;
                    
                    // Smoothly scale Y
                    const targetScale = 1 + (val * 30);
                    bars[i].scale.y += (targetScale - bars[i].scale.y) * 0.2;
                    bars[i].position.y = bars[i].scale.y; // keep bottom grounded
                }
                barsGroup.rotation.y += 0.001;
            } else {
                if(autoRotate) targetCameraAngle.x += 0.005;
            }
        }
        else if (currentStyle === 'waves') {
            if(autoRotate) targetCameraAngle.x += 0.002;
            
            const positions = waveGeometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const z = positions.getZ(i);
                const dist = Math.sqrt(x*x + z*z);
                
                let val = 0;
                if(dataArray) {
                    const bin = Math.floor(dist / 4);
                    if (bin < dataArray.length) val = dataArray[bin] / 255.0;
                }
                
                const wave = Math.sin(dist * 0.05 - time) * 10;
                positions.setY(i, waveOriginalY[i] + wave + (val * 25));
            }
            positions.needsUpdate = true;
        }

        particles.rotation.y -= 0.001;
        renderer.render(scene, camera);
    }

    btn.addEventListener('click', () => {
        isActive = !isActive;
        
        if (isActive) {
            btn.style.color = 'var(--accent-color)';
            container.style.display = 'block';
            document.body.classList.add('mode-3d-active');
            
            if (!scene) initThree();
            if (animationId) cancelAnimationFrame(animationId);
            animate();
        } else {
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
