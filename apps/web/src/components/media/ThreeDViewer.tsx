'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Canvas, useLoader } from '@react-three/fiber'
import { OrbitControls, Grid, useGLTF, useProgress, Html } from '@react-three/drei'
import { Loader2, RotateCcw } from 'lucide-react'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'

interface ThreeDViewerProps {
  url: string
  format?: 'glb' | 'gltf' | 'obj' | 'stl'
  className?: string
}

function GLTFModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url)
  return <primitive object={obj} />
}

function STLModel({ url }: { url: string }) {
  const geom = useLoader(STLLoader, url)
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#9ca3af" />
    </mesh>
  )
}

function Model({ url, format }: { url: string; format: string }) {
  if (format === 'glb' || format === 'gltf') return <GLTFModel url={url} />
  if (format === 'obj') return <OBJModel url={url} />
  if (format === 'stl') return <STLModel url={url} />
  return null
}

function SceneLoader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{Math.round(progress)}%</span>
      </div>
    </Html>
  )
}

function ThreeDViewerImpl({ url, format = 'glb', className }: ThreeDViewerProps) {
  const [autoRotate, setAutoRotate] = React.useState(true)

  return (
    <div className={cn('relative h-full w-full bg-muted/30', className)}>
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <React.Suspense fallback={<SceneLoader />}>
          <Model url={url} format={format ?? 'glb'} />
        </React.Suspense>
        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#d1d5db"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#6b7280"
          fadeDistance={25}
          infiniteGrid
        />
        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={1.5}
          enablePan={false}
          minDistance={1}
          maxDistance={20}
        />
      </Canvas>
      <Tooltip content={autoRotate ? '停止旋转' : '自动旋转'}>
        <button
          onClick={() => setAutoRotate((v) => !v)}
          className={cn(
            'absolute right-2 top-2 rounded-md border border-input bg-background/90 p-1.5 shadow-sm transition-colors hover:bg-accent',
            autoRotate && 'text-primary',
          )}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

export const ThreeDViewer = dynamic(() => Promise.resolve(ThreeDViewerImpl), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
}) as React.ComponentType<ThreeDViewerProps>
