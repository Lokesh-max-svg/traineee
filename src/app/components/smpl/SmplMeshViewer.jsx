"use client";

import { useRef, useEffect, useMemo, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { apiFetch } from "../../api/client";

// Cache for SMPL face indices (loaded once, reused)
let cachedFaceIndices = null;
let faceIndicesPromise = null;

/**
 * Load SMPL face indices from backend (cached)
 */
async function loadSmplFaceIndices(apiBaseUrl, jwtToken = null) {
  // Return cached if available
  if (cachedFaceIndices) {
    console.log("[SMPL] Using cached face indices:", cachedFaceIndices.length, "indices");
    return cachedFaceIndices;
  }

  // Return pending promise if loading
  if (faceIndicesPromise) {
    console.log("[SMPL] Face indices already loading...");
    return faceIndicesPromise;
  }

  // Load face indices from backend
  console.log("[SMPL] Loading face indices from:", `${apiBaseUrl}/trainer-app/smpl/faces`);

  faceIndicesPromise = (async () => {
    try {
      const response = await apiFetch(`${apiBaseUrl}/trainer-app/smpl/faces`);
      console.log("[SMPL] Face indices response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[SMPL] Face indices error response:", errorText);
        throw new Error(`Failed to load face indices: ${response.status}`);
      }

      const data = await response.json();
      console.log("[SMPL] Face indices response:", data.success, "faces:", data.data?.faceCount);

      if (data.success && data.data.faces) {
        cachedFaceIndices = new Uint32Array(data.data.faces.flat());
        console.log("[SMPL] Face indices loaded:", cachedFaceIndices.length, "indices");
        return cachedFaceIndices;
      }
      throw new Error("Invalid face indices response");
    } catch (error) {
      console.error("[SMPL] Error loading face indices:", error);
      faceIndicesPromise = null; // Reset to allow retry
      return null;
    }
  })();

  return faceIndicesPromise;
}

/**
 * SMPL mesh geometry component
 * Renders vertices from Float32Array as a mesh with proper face topology
 */
function SmplMesh({ vertices, faceIndices, color = "#10b981", wireframe = false }) {
  const meshRef = useRef();
  const geometryRef = useRef();

  // Log when props change
  useEffect(() => {
    console.log("[SmplMesh] Props updated - vertices:", vertices?.length, "faceIndices:", faceIndices?.length);
  }, [vertices, faceIndices]);

  // Create geometry with both vertices AND face indices
  const geometry = useMemo(() => {
    console.log("[SmplMesh] Creating geometry - vertices:", vertices?.length, "faceIndices:", faceIndices?.length);
    const geo = new THREE.BufferGeometry();

    if (vertices) {
      const positionAttribute = new THREE.BufferAttribute(vertices, 3);
      geo.setAttribute("position", positionAttribute);

      // Add face indices if available (critical for proper mesh rendering)
      if (faceIndices) {
        console.log("[SmplMesh] Setting face indices on geometry");
        geo.setIndex(new THREE.BufferAttribute(faceIndices, 1));
      } else {
        console.warn("[SmplMesh] No face indices available - mesh will render incorrectly!");
      }

      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    }

    return geo;
  }, [vertices, faceIndices]); // Recreate when either changes

  // Store ref
  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  // Update vertices without recreating geometry (for animation)
  useEffect(() => {
    if (!vertices || !geometryRef.current) return;

    const positionAttr = geometryRef.current.getAttribute("position");
    if (positionAttr && positionAttr.array !== vertices) {
      geometryRef.current.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometryRef.current.computeVertexNormals();
      geometryRef.current.computeBoundingSphere();
    }
  }, [vertices]);

  // Gentle rotation animation (preserve X rotation for coordinate system fix)
  useFrame((state) => {
    if (meshRef.current) {
      // Keep X rotation at PI (180°) for correct orientation
      meshRef.current.rotation.x = Math.PI;
      // Subtle idle Y rotation
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  if (!vertices) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow
      receiveShadow
      rotation={[Math.PI, 0, 0]} // Flip 180° around X-axis to correct SMPL coordinate system
    >
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        side={THREE.DoubleSide}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * Point cloud visualization (alternative to mesh)
 */
function SmplPointCloud({ vertices, color = "#10b981", size = 0.005 }) {
  const pointsRef = useRef();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (vertices) {
      geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    }
    return geo;
  }, [vertices]);

  useEffect(() => {
    if (vertices && pointsRef.current) {
      pointsRef.current.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
      );
    }
  }, [vertices]);

  if (!vertices) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color={color} size={size} sizeAttenuation />
    </points>
  );
}

/**
 * Scene setup with camera and lighting
 */
function SceneSetup() {
  const { camera } = useThree();

  useEffect(() => {
    // Position camera to view SMPL mesh
    camera.position.set(0, 1, 3);
    camera.lookAt(0, 0.8, 0);
  }, [camera]);

  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.5} />

      {/* Main directional light */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light from opposite side */}
      <directionalLight position={[-3, 3, -3]} intensity={0.3} />

      {/* Ground plane for reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#f3f4f6" opacity={0.5} transparent />
      </mesh>

      {/* Grid helper */}
      <gridHelper args={[4, 20, "#e5e7eb", "#e5e7eb"]} position={[0, 0, 0]} />
    </>
  );
}

/**
 * Loading skeleton for the 3D viewer
 */
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
      <p className="text-sm text-gray-500">Loading mesh...</p>
    </div>
  );
}

/**
 * Error display
 */
function ErrorDisplay({ error, onRetry }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <p className="text-sm text-gray-700 font-medium mb-1">Failed to load mesh</p>
        <p className="text-xs text-gray-500 mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Empty state display
 */
function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center p-6">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-gray-400 text-xl">3D</span>
        </div>
        <p className="text-sm text-gray-500">No mesh data available</p>
      </div>
    </div>
  );
}

/**
 * Main SMPL Mesh Viewer component
 * @param {Object} props
 * @param {Float32Array} props.vertices - Vertex data from useSmplMeshLoader
 * @param {boolean} props.loading - Loading state
 * @param {string} props.error - Error message if any
 * @param {Function} props.onRetry - Retry callback
 * @param {string} props.meshColor - Mesh color (default emerald)
 * @param {boolean} props.wireframe - Show wireframe mode
 * @param {boolean} props.showPoints - Show as point cloud instead of mesh
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.apiBaseUrl - API base URL for loading face indices
 * @param {string} props.jwtToken - JWT token for authentication
 */
export default function SmplMeshViewer({
  vertices,
  loading = false,
  error = null,
  onRetry,
  meshColor = "#10b981",
  wireframe = false,
  showPoints = false,
  className = "",
  apiBaseUrl = "http://localhost:5000",
  jwtToken = null,
}) {
  const [faceIndices, setFaceIndices] = useState(null);
  const [facesLoading, setFacesLoading] = useState(false);
  const [facesError, setFacesError] = useState(null);

  // Load SMPL face indices (once, cached globally)
  useEffect(() => {
    // Skip if showing point cloud
    if (showPoints) {
      console.log("[SmplMeshViewer] Skipping face load - showPoints mode");
      return;
    }

    // Use cached indices if available
    if (cachedFaceIndices) {
      console.log("[SmplMeshViewer] Using cached face indices");
      setFaceIndices(cachedFaceIndices);
      return;
    }

    // Don't reload if already have indices or currently loading
    if (faceIndices || facesLoading) {
      return;
    }

    console.log("[SmplMeshViewer] Starting face indices load from:", apiBaseUrl);
    setFacesLoading(true);
    setFacesError(null);

    loadSmplFaceIndices(apiBaseUrl, jwtToken)
      .then((indices) => {
        if (indices) {
          console.log("[SmplMeshViewer] Face indices loaded successfully:", indices.length);
          setFaceIndices(indices);
        } else {
          console.error("[SmplMeshViewer] Face indices load returned null");
          setFacesError("Failed to load face indices");
        }
      })
      .catch((err) => {
        console.error("[SmplMeshViewer] Face indices load error:", err);
        setFacesError(err.message);
      })
      .finally(() => setFacesLoading(false));
  }, [apiBaseUrl, jwtToken, showPoints, faceIndices, facesLoading]);

  // Show loading state
  if (loading || facesLoading) {
    return (
      <div className={`relative w-full h-full min-h-[300px] rounded-xl overflow-hidden ${className}`}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Show error state
  if (error || facesError) {
    return (
      <div className={`relative w-full h-full min-h-[300px] rounded-xl overflow-hidden ${className}`}>
        <ErrorDisplay error={error || facesError} onRetry={onRetry} />
      </div>
    );
  }

  // Show empty state
  if (!vertices) {
    return (
      <div className={`relative w-full h-full min-h-[300px] rounded-xl overflow-hidden ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[300px] rounded-xl overflow-hidden bg-gray-50 ${className}`}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1, 3]} fov={50} />
          <SceneSetup />

          {showPoints ? (
            <SmplPointCloud vertices={vertices} color={meshColor} />
          ) : (
            <SmplMesh
              vertices={vertices}
              faceIndices={faceIndices}
              color={meshColor}
              wireframe={wireframe}
            />
          )}

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1}
            maxDistance={10}
            target={[0, 0.8, 0]}
          />
        </Suspense>
      </Canvas>

      {/* Controls hint */}
      <div className="absolute bottom-3 left-3 text-xs text-gray-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}

/**
 * Standalone viewer that handles its own data loading
 * @param {Object} props
 * @param {string} props.binUrl - URL to the .bin file
 */
export function SmplMeshViewerWithLoader({ binUrl, ...props }) {
  // This would use the hook - but we keep it simple here
  // The parent component should use useSmplMeshLoader and pass vertices
  return <SmplMeshViewer {...props} />;
}
