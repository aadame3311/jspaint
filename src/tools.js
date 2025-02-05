(()=> {

// This is for linting stuff at the bottom.
/* eslint no-restricted-syntax: ["error", "ThisExpression"] */
/* eslint-disable no-restricted-syntax */

window.tools = [{
	// @#: polygonal selection, polygon selection, shape selection, freeform selection
	name: "Free-Form Select",
	help_icon: "p_free.gif",
	description: "Selects a free-form part of the picture to move, copy, or edit.",
	cursor: ["precise", [16, 16], "crosshair"],

	// A canvas for rendering a preview of the shape
	preview_canvas: null,
	
	// The vertices of the polygon
	points: [],
	
	// The boundaries of the polygon
	x_min: +Infinity,
	x_max: -Infinity,
	y_min: +Infinity,
	y_max: -Infinity,
	
	pointerdown() {
		this.x_min = pointer.x;
		this.x_max = pointer.x+1;
		this.y_min = pointer.y;
		this.y_max = pointer.y+1;
		this.points = [];
		this.preview_canvas = make_canvas(canvas.width, canvas.height);

		// End prior selection, drawing it to the canvas
		deselect();
	},
	paint(ctx, x, y) {
		// Constrain the pointer to the canvas
		pointer.x = Math.min(canvas.width, pointer.x);
		pointer.x = Math.max(0, pointer.x);
		pointer.y = Math.min(canvas.height, pointer.y);
		pointer.y = Math.max(0, pointer.y);
		// Add the point
		this.points.push(pointer);
		// Update the boundaries of the polygon
		this.x_min = Math.min(pointer.x, this.x_min);
		this.x_max = Math.max(pointer.x, this.x_max);
		this.y_min = Math.min(pointer.y, this.y_min);
		this.y_max = Math.max(pointer.y, this.y_max);

		bresenham_line(pointer_previous.x, pointer_previous.y, pointer.x, pointer.y, (x, y)=> {
			this.paint_iteration(x, y);
		});
	},
	paint_iteration(x, y) {
		// Constrain the inverty paint brush position to the canvas
		x = Math.min(canvas.width, x);
		x = Math.max(0, x);
		y = Math.min(canvas.height, y);
		y = Math.max(0, y);
		
		// Find the dimensions on the canvas of the tiny square to invert
		const inverty_size = 2;
		const rect_x = ~~(x - inverty_size/2);
		const rect_y = ~~(y - inverty_size/2);
		const rect_w = inverty_size;
		const rect_h = inverty_size;
		
		const ctx_dest = this.preview_canvas.ctx;
		const id_src = ctx.getImageData(rect_x, rect_y, rect_w, rect_h);
		const id_dest = ctx_dest.getImageData(rect_x, rect_y, rect_w, rect_h);
		
		for(let i=0, l=id_dest.data.length; i<l; i+=4){
			id_dest.data[i+0] = 255 - id_src.data[i+0];
			id_dest.data[i+1] = 255 - id_src.data[i+1];
			id_dest.data[i+2] = 255 - id_src.data[i+2];
			id_dest.data[i+3] = 255;
			// @TODO maybe: invert based on id_src.data[i+3] and the checkered background
		}
		
		ctx_dest.putImageData(id_dest, rect_x, rect_y);
	},
	pointerup() {
		this.preview_canvas.width = 1;
		this.preview_canvas.height = 1;

		const contents_within_polygon = copy_contents_within_polygon(
			canvas,
			this.points,
			this.x_min,
			this.y_min,
			this.x_max,
			this.y_max
		);
		
		if(selection){
			// for silly multitools feature
			alert("This isn't supposed to happen: Free-Form Select after Select in the tool chain?");
			meld_selection_into_canvas();
		}

		undoable({
			name: "Free-Form Select",
			icon: get_icon_for_tool(get_tool_by_name("Free-Form Select")),
			soft: true,
		}, ()=> {
			selection = new OnCanvasSelection(
				this.x_min,
				this.y_min,
				this.x_max - this.x_min,
				this.y_max - this.y_min,
				contents_within_polygon,
			);
			selection.cut_out_background();
		});
	},
	cancel() {
		if(!this.preview_canvas){return;}
		this.preview_canvas.width = 1;
		this.preview_canvas.height = 1;
	},
	drawPreviewUnderGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		if(!pointer_active && !pointer_over_canvas){return;}
		if(!this.preview_canvas){return;}

		ctx.scale(scale, scale);
		ctx.translate(translate_x, translate_y);

		ctx.drawImage(this.preview_canvas, 0, 0);
	},
	$options: $choose_transparent_mode
}, {
	// @#: rectangle selection, rectangular selection
	name: "Select",
	help_icon: "p_sel.gif",
	description: "Selects a rectangular part of the picture to move, copy, or edit.",
	cursor: ["precise", [16, 16], "crosshair"],
	selectBox(rect_x, rect_y, rect_width, rect_height) {
		if (rect_width > 1 && rect_height > 1) {
			var free_form_selection = selection;
			if(selection){
				// for silly multitools feature
				meld_selection_into_canvas();
			}
			if (ctrl) {
				undoable({name: "Crop"}, () => {
					var cropped_canvas = make_canvas(rect_width, rect_height);
					cropped_canvas.ctx.drawImage(canvas, -rect_x, -rect_y);
					ctx.copy(cropped_canvas);
					$canvas_handles.show();
					$canvas_area.trigger("resize");
				});
			} else if (free_form_selection) {
				// for silly multitools feature,
				// create a selection that's the Free-Form selection XOR the normal selection

				var x_min = Math.min(free_form_selection.x, rect_x);
				var y_min = Math.min(free_form_selection.y, rect_y);
				var x_max = Math.max(free_form_selection.x + free_form_selection.width, rect_x + rect_width);
				var y_max = Math.max(free_form_selection.y + free_form_selection.height, rect_y + rect_height);

				var contents_canvas = make_canvas(
					x_max - x_min,
					y_max - y_min,
				);
				var rect_canvas = make_canvas(
					x_max - x_min,
					y_max - y_min,
				);
				rect_canvas.ctx.drawImage(
					canvas,
					// source:
					rect_x,
					rect_y,
					rect_width,
					rect_height,
					// dest:
					rect_x - x_min,
					rect_y - y_min,
					rect_width,
					rect_height,
				);

				contents_canvas.ctx.drawImage(
					free_form_selection.canvas,
					free_form_selection.x - x_min,
					free_form_selection.y - y_min,
				);
				contents_canvas.ctx.globalCompositeOperation = "xor";
				contents_canvas.ctx.drawImage(rect_canvas, 0, 0);

				undoable({
					name: "Free-Form Select⊕Select",
					icon: get_icon_for_tools([
						get_tool_by_name("Free-Form Select"),
						get_tool_by_name("Select"),
					]),
					soft: true,
				}, ()=> {
					selection = new OnCanvasSelection(
						x_min,
						y_min,
						x_max - x_min,
						y_max - y_min,
						contents_canvas,
					);
					selection.cut_out_background();
				});
			} else {
				undoable({
					name: "Select",
					icon: get_icon_for_tool(get_tool_by_name("Select")),
					soft: true,
				}, ()=> {
					selection = new OnCanvasSelection(rect_x, rect_y, rect_width, rect_height);
				});
			}
		}
	},
	$options: $choose_transparent_mode
}, {
	// @#: eraser but also color replacer
	name: "Eraser/Color Eraser",
	help_icon: "p_erase.gif",
	description: "Erases a portion of the picture, using the selected eraser shape.",
	cursor: ["precise", [16, 16], "crosshair"],

	// binary mask of the drawn area, either opaque white or transparent
	mask_canvas: null,

	get_rect(x, y) {
		const rect_x = Math.ceil(x - eraser_size/2);
		const rect_y = Math.ceil(y - eraser_size/2);
		const rect_w = eraser_size;
		const rect_h = eraser_size;
		return {rect_x, rect_y, rect_w, rect_h};
	},

	drawPreviewUnderGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		if(!pointer_active && !pointer_over_canvas){return;}
		const {rect_x, rect_y, rect_w, rect_h} = this.get_rect(x, y);
		
		ctx.scale(scale, scale);
		ctx.translate(translate_x, translate_y);

		if (this.mask_canvas) {
			this.render_from_mask(ctx, true);
			if (transparency) {
				// animate for gradient
				requestAnimationFrame(update_helper_layer);
			}
		}

		ctx.fillStyle = colors.background;
		ctx.fillRect(rect_x, rect_y, rect_w, rect_h);
	},
	drawPreviewAboveGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		if(!pointer_active && !pointer_over_canvas){return;}

		const {rect_x, rect_y, rect_w, rect_h} = this.get_rect(x, y);

		ctx.scale(scale, scale);
		ctx.translate(translate_x, translate_y);
		const hairline_width = 1/scale;

		ctx.strokeStyle = "black";
		ctx.lineWidth = hairline_width;
		if (grid_visible) {
			ctx.strokeRect(rect_x+ctx.lineWidth/2, rect_y+ctx.lineWidth/2, rect_w, rect_h);
		} else {
			ctx.strokeRect(rect_x+ctx.lineWidth/2, rect_y+ctx.lineWidth/2, rect_w-ctx.lineWidth, rect_h-ctx.lineWidth);
		}
	},
	pointerdown() {
		this.mask_canvas = make_canvas(canvas.width, canvas.height);
	},
	render_from_mask(ctx, previewing) {
		ctx.save();
		ctx.globalCompositeOperation = "destination-out";
		ctx.drawImage(this.mask_canvas, 0, 0);
		ctx.restore();

		if (previewing || !transparency) {
			let color = colors.background;
			if (transparency) {
				const t = performance.now() / 2000;
				// 5 distinct colors, 5 distinct gradients, 7 color stops, 6 gradients
				const n = 6;
				const h = ctx.canvas.height;
				const y = (t % 1) * -h * (n - 1);
				const gradient = ctx.createLinearGradient(0, y, 0, y + h * n);
				gradient.addColorStop(0/n, "red");
				gradient.addColorStop(1/n, "gold");
				gradient.addColorStop(2/n, "#00d90b");
				gradient.addColorStop(3/n, "#2e64d9");
				gradient.addColorStop(4/n, "#8f2ed9");
				// last two same as the first two so it can seamlessly wrap
				gradient.addColorStop(5/n, "red");
				gradient.addColorStop(6/n, "gold");
				color = gradient;
			}
			const mask_fill_canvas = make_canvas(this.mask_canvas);
			replace_colors_with_swatch(mask_fill_canvas.ctx, color, 0, 0);
			ctx.drawImage(mask_fill_canvas, 0, 0);
		}
	},
	pointerup() {
		undoable({
			name: this.color_eraser_mode ? "Color Eraser" : "Eraser",
			icon: get_icon_for_tool(this),
		}, ()=> {
			this.render_from_mask(ctx);

			this.mask_canvas = null;
		});
	},
	cancel() {
		this.mask_canvas = null;
	},
	paint(ctx, x, y) {
		bresenham_line(pointer_previous.x, pointer_previous.y, pointer.x, pointer.y, (x, y)=> {
			this.paint_iteration(ctx, x, y);
		});
	},
	paint_iteration(ctx, x, y) {
		const {rect_x, rect_y, rect_w, rect_h} = this.get_rect(x, y);

		this.color_eraser_mode = button !== 0;
		
		if(!this.color_eraser_mode){
			// Eraser
			this.mask_canvas.ctx.fillStyle = "white";
			this.mask_canvas.ctx.fillRect(rect_x, rect_y, rect_w, rect_h);
		}else{
			// Color Eraser
			// Right click with the eraser to selectively replace
			// the selected foreground color with the selected background color
			
			const fg_rgba = get_rgba_from_color(colors.foreground);
			
			const test_image_data = ctx.getImageData(rect_x, rect_y, rect_w, rect_h);
			const result_image_data = this.mask_canvas.ctx.getImageData(rect_x, rect_y, rect_w, rect_h);
			
			for(let i=0, l=test_image_data.data.length; i<l; i+=4){
				if(
					test_image_data.data[i+0] === fg_rgba[0] &&
					test_image_data.data[i+1] === fg_rgba[1] &&
					test_image_data.data[i+2] === fg_rgba[2] &&
					test_image_data.data[i+3] === fg_rgba[3]
				){
					result_image_data.data[i+0] = 255;
					result_image_data.data[i+1] = 255;
					result_image_data.data[i+2] = 255;
					result_image_data.data[i+3] = 255;
				}
			}
			
			this.mask_canvas.ctx.putImageData(result_image_data, rect_x, rect_y);
		}
	},
	$options: $choose_eraser_size
}, {
	// @#: fill bucket, flood fill area, paint bucket, paint can
	name: "Fill With Color",
	help_icon: "p_paint.gif",
	description: "Fills an area with the selected drawing color.",
	cursor: ["fill-bucket", [8, 22], "crosshair"],
	pointerdown(ctx, x, y) {
		if(shift){
			undoable({
				name: "Replace Color",
				icon: get_icon_for_tool(this),
			}, ()=> {
				// Perform global color replacement
				draw_noncontiguous_fill(ctx, x, y, fill_color);
			});
		} else {
			undoable({
				name: "Fill With Color",
				icon: get_icon_for_tool(this),
			}, ()=> {
				// Perform a normal fill operation
				draw_fill(ctx, x, y, fill_color);
			});
		}
	}
}, {
	// @#: eyedropper, eye dropper, Pasteur pipette, select colors, pick colors
	name: "Pick Color",
	help_icon: "p_eye.gif",
	description: "Picks up a color from the picture for drawing.",
	cursor: ["eye-dropper", [9, 22], "crosshair"],
	deselect: true,
	
	current_color: "",
	display_current_color() {
		this.$options.css({
			background: this.current_color
		});
	},
	pointerdown() {
		$G.one("pointerup", () => {
			this.$options.css({
				background: ""
			});
		});
	},
	paint(ctx, x, y) {
		if(x >= 0 && y >= 0 && x < canvas.width && y < canvas.height){
			const id = ctx.getImageData(~~x, ~~y, 1, 1);
			const r = id.data[0];
			const g = id.data[1];
			const b = id.data[2];
			const a = id.data[3];
			this.current_color = `rgba(${r},${g},${b},${a/255})`;
		}else{
			this.current_color = "white";
		}
		this.display_current_color();
	},
	pointerup() {
		colors[fill_color_k] = this.current_color;
		$G.trigger("option-changed");
	},
	$options: $(E("div"))
}, {
	// @#: magnifying glass, zoom
	name: "Magnifier",
	help_icon: "p_zoom.gif",
	description: "Changes the magnification.",
	cursor: ["magnifier", [16, 16], "zoom-in"], // overridden below
	deselect: true,
	
	getProspectiveMagnification: ()=> (
		magnification === 1 ? return_to_magnification : 1
	),

	drawPreviewAboveGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		if(!pointer_active && !pointer_over_canvas){return;}
		if(pointer_active) { return; }
		const prospective_magnification = this.getProspectiveMagnification();

		// hacky place to put this but whatever
		// use specific zoom-in/zoom-out as fallback,
		// even though the custom cursor image is less descriptive
		// because there's no generic "zoom" css cursor
		if(prospective_magnification < magnification) {
			$canvas.css({
				cursor: make_css_cursor("magnifier", [16, 16], "zoom-out"),
			});
		} else {
			$canvas.css({
				cursor: make_css_cursor("magnifier", [16, 16], "zoom-in"),
			});
		}

		if(prospective_magnification < magnification) { return; } // hide if would be zooming out

		// prospective viewport size in document coords
		const w = $canvas_area.width() / prospective_magnification;
		const h = $canvas_area.height() / prospective_magnification;

		let rect_x1 = ~~(x - w/2);
		let rect_y1 = ~~(y - h/2);

		// try to move rect into bounds without squishing
		rect_x1 = Math.max(0, rect_x1);
		rect_y1 = Math.max(0, rect_y1);
		rect_x1 = Math.min(canvas.width - w, rect_x1);
		rect_y1 = Math.min(canvas.height - h, rect_y1);

		let rect_x2 = rect_x1 + w;
		let rect_y2 = rect_y1 + h;
		
		// clamp rect to bounds (with squishing)
		rect_x1 = Math.max(0, rect_x1);
		rect_y1 = Math.max(0, rect_y1);
		rect_x2 = Math.min(canvas.width, rect_x2);
		rect_y2 = Math.min(canvas.height, rect_y2);
		
		const rect_w = rect_x2 - rect_x1;
		const rect_h = rect_y2 - rect_y1;
		const rect_x = rect_x1;
		const rect_y = rect_y1;

		const id_src = canvas.ctx.getImageData(rect_x, rect_y, rect_w+1, rect_h+1);
		const id_dest = ctx.getImageData((rect_x+translate_x)*scale, (rect_y+translate_y)*scale, rect_w*scale+1, rect_h*scale+1);
		
		function copyPixelInverted(x_dest, y_dest) {
			const x_src = ~~(x_dest / scale);
			const y_src = ~~(y_dest / scale);
			const index_src = (x_src + y_src * id_src.width) * 4;
			const index_dest = (x_dest + y_dest * id_dest.width) * 4;
			id_dest.data[index_dest+0] = 255 - id_src.data[index_src+0];
			id_dest.data[index_dest+1] = 255 - id_src.data[index_src+1];
			id_dest.data[index_dest+2] = 255 - id_src.data[index_src+2];
			id_dest.data[index_dest+3] = 255;
			// @TODO maybe: invert based on id_src.data[index_src+3] and the checkered background
		}

		for(let x=0, limit=id_dest.width; x<limit; x+=1){
			copyPixelInverted(x, 0);
			copyPixelInverted(x, id_dest.height-1);
		}
		for(let y=1, limit=id_dest.height-1; y<limit; y+=1){
			copyPixelInverted(0, y);
			copyPixelInverted(id_dest.width-1, y);
		}

		// for debug: fill rect
		// for(let x=0, x_limit=id_dest.width; x<x_limit; x+=1){
		// 	for(let y=1, y_limit=id_dest.height-1; y<y_limit; y+=1){
		// 		copyPixelInverted(x, y);
		// 	}
		// }
		
		ctx.putImageData(id_dest, (rect_x+translate_x)*scale, (rect_y+translate_y)*scale);

		// debug:
		// ctx.scale(scale, scale);
		// ctx.translate(translate_x, translate_y);
		// ctx.strokeStyle = "#f0f";
		// ctx.strokeRect(rect_x1, rect_y1, rect_w, rect_h);
	},
	pointerdown(ctx, x, y) {
		const prev_magnification = magnification;
		const prospective_magnification = this.getProspectiveMagnification();
		
		set_magnification(prospective_magnification);

		if (magnification > prev_magnification) {

			// (new) viewport size in document coords
			const w = $canvas_area.width() / magnification;
			const h = $canvas_area.height() / magnification;

			const scroll_left = (x - w/2) * magnification / prev_magnification;
			const scroll_top = (y - h/2) * magnification / prev_magnification;
			
			$canvas_area.scrollLeft(scroll_left);
			$canvas_area.scrollTop(scroll_top);
			$canvas_area.trigger("scroll");
		}
	},
	$options: $choose_magnification
}, {
	name: "Pencil",
	help_icon: "p_pencil.gif",
	description: "Draws a free-form line one pixel wide.",
	cursor: ["pencil", [13, 23], "crosshair"],
	stroke_only: true,
	get_brush() {
		return {size: pencil_size, shape: "circle"};
	}
}, {
	name: "Brush",
	help_icon: "p_brush.gif",
	description: "Draws using a brush with the selected shape and size.",
	cursor: ["precise-dotted", [16, 16], "crosshair"],
	dynamic_preview_cursor: true,
	get_brush() {
		return {size: brush_size, shape: brush_shape};
	},
	$options: $choose_brush
}, {
	// @#: spray paint can, air brush, aerograph, graffiti, scatter
	name: "Airbrush",
	help_icon: "p_airb.gif",
	description: "Draws using an airbrush of the selected size.",
	cursor: ["airbrush", [7, 22], "crosshair"],
	paint_on_time_interval: 5,
	paint_mask(ctx, x, y) {
		const r = airbrush_size / 2;
		for(let i = 0; i < 6 + r/5; i++){
			const rx = (Math.random()*2-1) * r;
			const ry = (Math.random()*2-1) * r;
			const d = rx*rx + ry*ry;
			if(d <= r * r){
				ctx.fillRect(x + ~~rx, y + ~~ry, 1, 1);
			}
		}
		update_helper_layer();
	},
	$options: $choose_airbrush_size
}, {
	name: "Text",
	help_icon: "p_txt.gif",
	description: "Inserts text into the picture.",
	cursor: ["precise", [16, 16], "crosshair"],
	preload() {
		setTimeout(FontDetective.preload, 10);
	},
	selectBox(rect_x, rect_y, rect_width, rect_height) {
		if (rect_width > 1 && rect_height > 1) {
			textbox = new OnCanvasTextBox(rect_x, rect_y, rect_width, rect_height);
		}
	},
	$options: $choose_transparent_mode
}, {
	name: "Line",
	help_icon: "p_line.gif",
	description: "Draws a straight line with the selected line width.",
	cursor: ["precise", [16, 16], "crosshair"],
	stroke_only: true,
	shape(ctx, x, y, w, h) {
		update_brush_for_drawing_lines(stroke_size);
		draw_line(ctx, x, y, x+w, y+h, stroke_size);
	},
	$options: $choose_stroke_size
}, {
	name: "Curve",
	help_icon: "p_curve.gif",
	description: "Draws a curved line with the selected line width.",
	cursor: ["precise", [16, 16], "crosshair"],
	stroke_only: true,
	points: [],
	preview_canvas: null,
	pointerup(ctx, x, y) {
		if(this.points.length >= 4){
			undoable({
				name: "Curve",
				icon: get_icon_for_tool(this),
			}, ()=> {
				ctx.drawImage(this.preview_canvas, 0, 0);
			});
			this.points = [];
		}
	},
	pointerdown(ctx, x, y) {
		if(this.points.length < 1){
			this.preview_canvas = make_canvas(canvas.width, canvas.height);
			this.points.push({x, y});
			// second point so first action draws a line
			this.points.push({x, y});
		}else{
			this.points.push({x, y});
		}
	},
	paint(ctx, x, y) {
		if(this.points.length < 1){ return; }

		update_brush_for_drawing_lines(stroke_size);

		const i = this.points.length - 1;
		this.points[i].x = x;
		this.points[i].y = y;
		
		this.preview_canvas.ctx.clearRect(0, 0, this.preview_canvas.width, this.preview_canvas.height);
		this.preview_canvas.ctx.strokeStyle = stroke_color;

		// Draw curves on preview canvas
		if (this.points.length === 4) {
			draw_bezier_curve(
				this.preview_canvas.ctx,
				this.points[0].x, this.points[0].y,
				this.points[2].x, this.points[2].y,
				this.points[3].x, this.points[3].y,
				this.points[1].x, this.points[1].y,
				stroke_size
			);
		}
		else if (this.points.length === 3) {
			draw_quadratic_curve(
				this.preview_canvas.ctx,
				this.points[0].x, this.points[0].y,
				this.points[2].x, this.points[2].y,
				this.points[1].x, this.points[1].y,
				stroke_size
			);
		}
		else {
			draw_line_strip(
				this.preview_canvas.ctx,
				this.points
			);
		}
		
	},
	drawPreviewUnderGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		// if(!pointer_active && !pointer_over_canvas){return;}
		if(!this.preview_canvas){return;}
		ctx.scale(scale, scale);
		ctx.translate(translate_x, translate_y);

		if (this.points.length >= 1) {
			ctx.drawImage(this.preview_canvas, 0, 0);
		}
	},
	cancel() {
		this.points = [];
	},
	end() {
		this.points = [];
		update_helper_layer();
	},
	$options: $choose_stroke_size
}, {
	// @#: square
	name: "Rectangle",
	help_icon: "p_rect.gif",
	description: "Draws a rectangle with the selected fill style.",
	cursor: ["precise", [16, 16], "crosshair"],
	shape(ctx, x, y, w, h) {
		if(w < 0){ x += w; w = -w; }
		if(h < 0){ y += h; h = -h; }
		
		if(this.$options.fill){
			ctx.fillRect(x, y, w, h);
		}
		if(this.$options.stroke){
			if(w < stroke_size * 2 || h < stroke_size * 2){
				ctx.save();
				ctx.fillStyle = ctx.strokeStyle;
				ctx.fillRect(x, y, w, h);
				ctx.restore();
			}else{
				// TODO: shouldn't that be ~~(stroke_size / 2)?
				ctx.strokeRect(x + stroke_size / 2, y + stroke_size / 2, w - stroke_size, h - stroke_size);
			}
		}
	},
	$options: $ChooseShapeStyle()
}, {
	name: "Polygon",
	help_icon: "p_poly.gif",
	description: "Draws a polygon with the selected fill style.",
	cursor: ["precise", [16, 16], "crosshair"],
	
	// Record the last click for double-clicking
	// A double click happens on pointerdown of a second click
	// (within a cylindrical volume in 2d space + 1d time)
	last_click_pointerdown: {x: -Infinity, y: -Infinity, time: -Infinity},
	last_click_pointerup: {x: -Infinity, y: -Infinity, time: -Infinity},
	
	// The vertices of the polygon
	points: [],
	
	// A canvas for rendering a preview of the shape
	preview_canvas: null,

	pointerup(ctx, x, y) {
		if(this.points.length < 1){ return; }
		
		const i = this.points.length - 1;
		this.points[i].x = x;
		this.points[i].y = y;
		const dx = this.points[i].x - this.points[0].x;
		const dy = this.points[i].y - this.points[0].y;
		const d = Math.sqrt(dx*dx + dy*dy);
		if(d < stroke_size * 5.1010101){ // arbitrary 101 (TODO: find correct value (or formula))
			this.complete(ctx);
		}
		
		this.last_click_pointerup = {x, y, time: +(new Date)};
	},
	pointerdown(ctx, x, y) {
		if(this.points.length < 1){
			this.preview_canvas = make_canvas(canvas.width, canvas.height);
		
			// Add the first point of the polygon
			this.points.push({x, y});
			// Add a second point so first action draws a line
			this.points.push({x, y});
		}else{
			const lx = this.last_click_pointerdown.x;
			const ly = this.last_click_pointerdown.y;
			const lt = this.last_click_pointerdown.time;
			const dx = x - lx;
			const dy = y - ly;
			const dt = +(new Date) - lt;
			const d = Math.sqrt(dx*dx + dy*dy);
			if(d < 4.1010101 && dt < 250){ // arbitrary 101 (TODO: find correct value (or formula))
				this.complete(ctx);
			}else{
				// Add the point
				this.points.push({x, y});
			}
		}
		this.last_click_pointerdown = {x, y, time: +new Date};
	},
	paint(ctx, x, y) {
		if(this.points.length < 1){ return; }

		const i = this.points.length - 1;
		this.points[i].x = x;
		this.points[i].y = y;

		this.preview_canvas.ctx.clearRect(0, 0, this.preview_canvas.width, this.preview_canvas.height);
		if (this.$options.fill && !this.$options.stroke) {

			this.preview_canvas.ctx.drawImage(canvas, 0, 0);
			this.preview_canvas.ctx.strokeStyle = "white";
			this.preview_canvas.ctx.globalCompositeOperation = "difference";
			var orig_stroke_size = stroke_size;
			stroke_size = 2;
			draw_line_strip(
				this.preview_canvas.ctx,
				this.points
			);
			stroke_size = orig_stroke_size;
		} else {

			this.preview_canvas.ctx.strokeStyle = stroke_color;
			draw_line_strip(
				this.preview_canvas.ctx,
				this.points
			);
		}
	},
	drawPreviewUnderGrid(ctx, x, y, grid_visible, scale, translate_x, translate_y) {
		// if(!pointer_active && !pointer_over_canvas){return;}
		if(!this.preview_canvas){return;}

		ctx.scale(scale, scale);
		ctx.translate(translate_x, translate_y);

		ctx.drawImage(this.preview_canvas, 0, 0);
	},
	complete(ctx) {
		if (this.points.length >= 3) {
			undoable({
				name: "Polygon",
				icon: get_icon_for_tool(this),
			}, ()=> {
				ctx.fillStyle = fill_color;
				ctx.strokeStyle = stroke_color;

				var orig_stroke_size = stroke_size;
				if (this.$options.fill && !this.$options.stroke) {
					stroke_size = 2;
					ctx.strokeStyle = fill_color;
				}

				draw_polygon(
					ctx,
					this.points,
					this.$options.stroke || (this.$options.fill && !this.$options.stroke),
					this.$options.fill
				);

				stroke_size = orig_stroke_size;
			});
		}

		this.reset();
	},
	cancel() {
		this.reset();
	},
	end(ctx) {
		this.complete(ctx);
		update_helper_layer();
	},
	reset() {
		this.points = [];
		this.last_click_pointerdown = {x: -Infinity, y: -Infinity, time: -Infinity};
		this.last_click_pointerup = {x: -Infinity, y: -Infinity, time: -Infinity};
		
		if(!this.preview_canvas){return;}
		this.preview_canvas.width = 1;
		this.preview_canvas.height = 1;
	},
	shape_colors: true,
	$options: $ChooseShapeStyle()
}, {
	// @#: circle
	name: "Ellipse",
	help_icon: "p_oval.gif",
	description: "Draws an ellipse with the selected fill style.",
	cursor: ["precise", [16, 16], "crosshair"],
	shape(ctx, x, y, w, h) {
		if(w < 0){ x += w; w = -w; }
		if(h < 0){ y += h; h = -h; }

		if(w < stroke_size || h < stroke_size){
			ctx.fillStyle = ctx.strokeStyle;
			draw_ellipse(ctx, x, y, w, h, false, true);
		}else{
			draw_ellipse(
				ctx,
				x + ~~(stroke_size / 2),
				y + ~~(stroke_size / 2),
				w - stroke_size,
				h - stroke_size,
				this.$options.stroke,
				this.$options.fill
			);
		}
	},
	$options: $ChooseShapeStyle()
}, {
	// @#: rounded square
	name: "Rounded Rectangle",
	help_icon: "p_rrect.gif",
	description: "Draws a rounded rectangle with the selected fill style.",
	cursor: ["precise", [16, 16], "crosshair"],
	shape(ctx, x, y, w, h) {
		if(w < 0){ x += w; w = -w; }
		if(h < 0){ y += h; h = -h; }

		if(w < stroke_size || h < stroke_size){
			ctx.fillStyle = ctx.strokeStyle;
			const radius = Math.min(8, w/2, h/2);
			// const radius_x = Math.min(8, w/2);
			// const radius_y = Math.min(8, h/2);
			draw_rounded_rectangle(
				ctx,
				x, y, w, h,
				radius, radius,
				// radius_x, radius_y,
				false,
				true
			);
		}else{
			const radius = Math.min(8, (w - stroke_size)/2, (h - stroke_size)/2);
			// const radius_x = Math.min(8, (w - stroke_size)/2);
			// const radius_y = Math.min(8, (h - stroke_size)/2);
			draw_rounded_rectangle(
				ctx,
				x + ~~(stroke_size / 2),
				y + ~~(stroke_size / 2),
				w - stroke_size,
				h - stroke_size,
				radius, radius,
				// radius_x, radius_y,
				this.$options.stroke,
				this.$options.fill
			);
		}
	},
	$options: $ChooseShapeStyle()
}];

/* eslint-enable no-restricted-syntax */

tools.forEach((tool)=> {
	if (tool.selectBox) {
		let drag_start_x = 0;
		let drag_start_y = 0;
		let pointer_has_moved = false;
		let rect_x = 0;
		let rect_y = 0;
		let rect_width = 0;
		let rect_height = 0;
		
		tool.pointerdown = ()=> {
			drag_start_x = pointer.x;
			drag_start_y = pointer.y;
			pointer_has_moved = false;
			$G.one("pointermove", ()=> {
				pointer_has_moved = true;
			});
			if(selection){
				meld_selection_into_canvas();
			}
			if(textbox){
				meld_textbox_into_canvas();
			}
			$canvas_handles.hide();
		};
		tool.paint = ()=> {
			rect_x = ~~Math.max(0, Math.min(drag_start_x, pointer.x));
			rect_y = ~~Math.max(0, Math.min(drag_start_y, pointer.y));
			rect_width = (~~Math.min(canvas.width, Math.max(drag_start_x, pointer.x) + 1)) - rect_x;
			rect_height = (~~Math.min(canvas.height, Math.max(drag_start_y, pointer.y + 1))) - rect_y;
		};
		tool.pointerup = ()=> {
			$canvas_handles.show();
			tool.selectBox(rect_x, rect_y, rect_width, rect_height);
		};
		tool.cancel = ()=> {
			$canvas_handles.show();
		};
		tool.drawPreviewUnderGrid = (ctx, x, y, grid_visible, scale, translate_x, translate_y)=> {
			if(!pointer_active){ return; }
			if(!pointer_has_moved) { return; }

			ctx.scale(scale, scale);
			ctx.translate(translate_x, translate_y);

			// make the document canvas part of the helper canvas so that inversion can apply to it
			ctx.drawImage(canvas, 0, 0);
		};
		tool.drawPreviewAboveGrid = (ctx, x, y, grid_visible, scale, translate_x, translate_y)=> {
			if(!pointer_active){ return; }
			if(!pointer_has_moved) { return; }

			draw_selection_box(ctx, rect_x, rect_y, rect_width, rect_height, scale, translate_x, translate_y);
		};
	}
	if (tool.shape) {
		tool.shape_canvas = null;
		tool.pointerdown = ()=> {
			tool.shape_canvas = make_canvas(canvas.width, canvas.height);
		};
		tool.paint = ()=> {
			tool.shape_canvas.ctx.clearRect(0, 0, tool.shape_canvas.width, tool.shape_canvas.height);
			tool.shape_canvas.ctx.fillStyle = ctx.fillStyle;
			tool.shape_canvas.ctx.strokeStyle = ctx.strokeStyle;
			tool.shape(tool.shape_canvas.ctx, pointer_start.x, pointer_start.y, pointer.x-pointer_start.x, pointer.y-pointer_start.y);
		};
		tool.pointerup = ()=> {
			if(!tool.shape_canvas){ return; }
			undoable({
				name: tool.name,
				icon: get_icon_for_tool(tool),
			}, ()=> {
				ctx.drawImage(tool.shape_canvas, 0, 0);
				tool.shape_canvas = null;
			});
		};
		tool.drawPreviewUnderGrid = (ctx, x, y, grid_visible, scale, translate_x, translate_y)=> {
			if(!pointer_active){ return; }
			if(!tool.shape_canvas){ return; }

			ctx.scale(scale, scale);
			ctx.translate(translate_x, translate_y);

			ctx.drawImage(tool.shape_canvas, 0, 0);
		};
	}
	if (tool.paint_mask) {

		// binary mask of the drawn area, either opaque white or transparent
		tool.mask_canvas = null;

		tool.pointerdown = (ctx, x, y)=> {
			if (!tool.mask_canvas) {
				tool.mask_canvas = make_canvas(canvas.width, canvas.height);
			}
			if (tool.mask_canvas.width !== canvas.width) {
				tool.mask_canvas.width = canvas.width;
			}
			if (tool.mask_canvas.height !== canvas.height) {
				tool.mask_canvas.height = canvas.height;
			}
			tool.mask_canvas.ctx.disable_image_smoothing();
		};
		tool.pointerup = ()=> {
			undoable({
				name: tool.name,
				icon: get_icon_for_tool(tool),
			}, ()=> {
				tool.render_from_mask(ctx);

				tool.mask_canvas.width = 1;
				tool.mask_canvas.height = 1;
			});
		};
		tool.paint = (ctx, x, y)=> {
			tool.paint_mask(tool.mask_canvas.ctx, x, y);
		};
		tool.cancel = ()=> {
			if (tool.mask_canvas) {
				tool.mask_canvas.width = 1;
				tool.mask_canvas.height = 1;
			}
		};
		tool.render_from_mask = (ctx, previewing)=> { // could be private
			ctx.save();
			ctx.globalCompositeOperation = "destination-out";
			ctx.drawImage(tool.mask_canvas, 0, 0);
			ctx.restore();

			let color = stroke_color;
			const translucent = get_rgba_from_color(color)[3] < 255;
			if (translucent && previewing) {
				const t = performance.now() / 2000;
				// 5 distinct colors, 5 distinct gradients, 7 color stops, 6 gradients
				const n = 6;
				const h = ctx.canvas.height;
				const y = (t % 1) * -h * (n - 1);
				const gradient = ctx.createLinearGradient(0, y, 0, y + h * n);
				gradient.addColorStop(0/n, "red");
				gradient.addColorStop(1/n, "gold");
				gradient.addColorStop(2/n, "#00d90b");
				gradient.addColorStop(3/n, "#2e64d9");
				gradient.addColorStop(4/n, "#8f2ed9");
				// last two same as the first two so it can seamlessly wrap
				gradient.addColorStop(5/n, "red");
				gradient.addColorStop(6/n, "gold");
				color = gradient;
			}
			// TODO: perf: keep this canvas around too
			const mask_fill_canvas = make_canvas(tool.mask_canvas);
			replace_colors_with_swatch(mask_fill_canvas.ctx, color, 0, 0);
			ctx.drawImage(mask_fill_canvas, 0, 0);
			return translucent;
		};
		tool.drawPreviewUnderGrid = (ctx, x, y, grid_visible, scale, translate_x, translate_y)=> {
			if(!pointer_active && !pointer_over_canvas){return;}

			ctx.scale(scale, scale);
			ctx.translate(translate_x, translate_y);

			if (tool.mask_canvas) {
				const should_animate = tool.render_from_mask(ctx, true);
				if (should_animate) {
					// animate for gradient
					requestAnimationFrame(update_helper_layer);
				}
			}
		};
	}
	if (tool.get_brush) {
		// binary mask of the drawn area, either opaque white or transparent
		tool.mask_canvas = null;

		tool.init_mask_canvas = (ctx, x, y)=> {
			if (!tool.mask_canvas) {
				tool.mask_canvas = make_canvas(canvas.width, canvas.height);
			}
			if (tool.mask_canvas.width !== canvas.width) {
				tool.mask_canvas.width = canvas.width;
			}
			if (tool.mask_canvas.height !== canvas.height) {
				tool.mask_canvas.height = canvas.height;
			}
			tool.mask_canvas.ctx.disable_image_smoothing();
		};
		tool.pointerdown = (ctx, x, y)=> {
			tool.init_mask_canvas();
		};
		tool.pointerup = ()=> {
			undoable({
				name: tool.name,
				icon: get_icon_for_tool(tool),
			}, ()=> {
				tool.render_from_mask(ctx);

				tool.mask_canvas.width = 1;
				tool.mask_canvas.height = 1;
			});
		};

		tool.paint = ()=> {
			const brush = tool.get_brush();
			const circumference_points = get_circumference_points_for_brush(brush.shape, brush.size);
			tool.mask_canvas.ctx.fillStyle = stroke_color;
			const iterate_line = brush.size > 1 ? brosandham_line : bresenham_line;
			iterate_line(pointer_previous.x, pointer_previous.y, pointer.x, pointer.y, (x, y)=> {
				for (const point of circumference_points) {
					tool.mask_canvas.ctx.fillRect(x + point.x, y + point.y, 1, 1);
				}
			});
			stamp_brush_canvas(tool.mask_canvas.ctx, pointer_previous.x, pointer_previous.y, brush.shape, brush.size);
			stamp_brush_canvas(tool.mask_canvas.ctx, pointer.x, pointer.y, brush.shape, brush.size);
		};
		
		tool.cancel = ()=> {
			if (tool.mask_canvas) {
				tool.mask_canvas.width = 1;
				tool.mask_canvas.height = 1;
			}
		};
		tool.render_from_mask = (ctx, previewing)=> { // could be private
			ctx.save();
			ctx.globalCompositeOperation = "destination-out";
			ctx.drawImage(tool.mask_canvas, 0, 0);
			ctx.restore();

			let color = stroke_color;
			const translucent = get_rgba_from_color(color)[3] < 255;
			if (translucent && previewing) {
				const t = performance.now() / 2000;
				// 5 distinct colors, 5 distinct gradients, 7 color stops, 6 gradients
				const n = 6;
				const h = ctx.canvas.height;
				const y = (t % 1) * -h * (n - 1);
				const gradient = ctx.createLinearGradient(0, y, 0, y + h * n);
				gradient.addColorStop(0/n, "red");
				gradient.addColorStop(1/n, "gold");
				gradient.addColorStop(2/n, "#00d90b");
				gradient.addColorStop(3/n, "#2e64d9");
				gradient.addColorStop(4/n, "#8f2ed9");
				// last two same as the first two so it can seamlessly wrap
				gradient.addColorStop(5/n, "red");
				gradient.addColorStop(6/n, "gold");
				color = gradient;
			}
			// TODO: perf: keep this canvas around too
			const mask_fill_canvas = make_canvas(tool.mask_canvas);
			if (previewing && tool.dynamic_preview_cursor) {
				const brush = tool.get_brush();
				// dynamic cursor preview:
				// stamp just onto this temporary canvas so it's temporary
				stamp_brush_canvas(mask_fill_canvas.ctx, pointer.x, pointer.y, brush.shape, brush.size);
			}
			replace_colors_with_swatch(mask_fill_canvas.ctx, color, 0, 0);
			ctx.drawImage(mask_fill_canvas, 0, 0);
			return translucent;
		};
		tool.drawPreviewUnderGrid = (ctx, x, y, grid_visible, scale, translate_x, translate_y)=> {
			if(!pointer_active && !pointer_over_canvas){return;}

			ctx.scale(scale, scale);
			ctx.translate(translate_x, translate_y);

			tool.init_mask_canvas();

			const should_animate = tool.render_from_mask(ctx, true);

			if (should_animate) {
				// animate for gradient
				requestAnimationFrame(update_helper_layer);
			}
		};
	}
});

})();
