import os
import subprocess
import argparse
from pathlib import Path

# Path to the OpenSCAD binary on Mac
OPENSCAD_BIN = "/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD"

def svg_to_stl(svg_path: str, output_stl: str, thickness: float = 0.6):
    """
    Extrudes an SVG file into a 3D STL file using OpenSCAD.
    """
    svg_file = Path(svg_path).resolve()
    stl_file = Path(output_stl).resolve()
    
    if not svg_file.exists():
        print(f"❌ Error: SVG file not found at {svg_file}")
        return

    # Create a temporary OpenSCAD script
    # We use linear_extrude to pull the 2D SVG into 3D. 
    # Center=true keeps it centered on the Z axis if needed, but false is usually better for placing flat on a build plate.
    scad_content = f"""
    // Auto-generated OpenSCAD script for Lore Key SVG Extrusion
    linear_extrude(height = {thickness}, center = false, convexity = 10) {{
        import("{svg_file}");
    }}
    """
    
    scad_file = svg_file.with_suffix('.scad')
    with open(scad_file, "w") as f:
        f.write(scad_content)

    print(f"⚙️  Extruding {svg_file.name} to {thickness}mm...")

    # Run OpenSCAD in command line mode to generate the STL
    try:
        subprocess.run(
            [OPENSCAD_BIN, "-o", str(stl_file), str(scad_file)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        print(f"✅ Successfully created STL: {stl_file.name}")
    except subprocess.CalledProcessError as e:
        print(f"❌ OpenSCAD failed to generate the STL.")
        print("Error Output:\n", e.stderr.decode())
    except FileNotFoundError:
        print(f"❌ OpenSCAD not found at {OPENSCAD_BIN}. Please make sure it is installed.")
    finally:
        # Clean up the temporary scad file
        if scad_file.exists():
            os.remove(scad_file)

def main():
    parser = argparse.ArgumentParser(description="Convert Lore Key SVG faceplates to 3D STL files.")
    parser.add_argument("svg_file", help="Path to the input SVG file")
    parser.add_argument("--out", "-o", help="Path to the output STL file", default=None)
    parser.add_argument("--thickness", "-t", type=float, default=0.6, help="Extrusion height in mm (default: 0.6mm)")
    
    args = parser.parse_args()
    
    output = args.out
    if not output:
        output = Path(args.svg_file).with_suffix('.stl')
        
    svg_to_stl(args.svg_file, output, args.thickness)

if __name__ == "__main__":
    main()
