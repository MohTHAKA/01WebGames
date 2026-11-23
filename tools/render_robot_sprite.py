"""Render a transparent top-down 2D sprite of the Spike Robot (from the 01Skills Unity project).

Run: blender -b -P tools/render_robot_sprite.py -- <input.fbx> <output.png>
"""

import sys

import bpy
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1 :][:2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

mn = Vector((1e9, 1e9, 1e9))
mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w))
        mx = Vector(map(max, mx, w))
center = (mn + mx) / 2
size = mx - mn
print("BBOX", tuple(mn), tuple(mx), "SIZE", tuple(size), [o.name for o in meshes])

# The FBX textures live in the Unity project and do not import, so use flat brand-palette materials.
COLORS = {"tire": (0.05, 0.08, 0.09, 1), "body": (0.38, 0.98, 1.0, 1)}
for o in meshes:
    mat = bpy.data.materials.new(o.name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = COLORS["tire"] if "tire" in o.name.lower() else COLORS["body"]
    bsdf.inputs["Roughness"].default_value = 0.6
    o.data.materials.clear()
    o.data.materials.append(mat)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = out

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
scene.world = world

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = max(size.x, size.y, size.z) * 1.15
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (center.x, center.y, mx.z + max(size) * 3)
cam.rotation_euler = (0, 0, 0)
scene.camera = cam

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 3.0
sun = bpy.data.objects.new("sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (0.5, 0.2, 0.3)

bpy.ops.render.render(write_still=True)
