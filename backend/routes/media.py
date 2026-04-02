import os
from flask import Blueprint, request, jsonify, current_app, send_from_directory, redirect, url_for
from models import db, Order, OrderItem, Media
from werkzeug.utils import secure_filename
from config import USE_CLOUDINARY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
import os

media_bp = Blueprint('media', __name__)

def allowed_file(filename):
    from config import ALLOWED_EXTENSIONS
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@media_bp.route('/orders/<int:order_id>/media', methods=['GET'])
def get_media(order_id):
    order = Order.query.get_or_404(order_id)
    media_list = []
    for m in order.media:
        # Exclude item-level media (item_id not NULL) from this list
        if m.item_id is not None:
            continue
        # Use file_url if available (Cloudinary or local full URL), otherwise construct URL
        if m.file_url:
            display_url = m.file_url
        else:
            # For local files stored without full URL, construct it (relative URL)
            display_url = f"/uploads/{m.file_path.replace(os.sep, '/')}"
        media_list.append({
            'id': m.id,
            'file_path': m.file_path,
            'file_url': display_url,
            'file_type': m.file_type,
            'side': m.side,
            'is_design': m.is_design
        })
    return jsonify(media_list), 200

@media_bp.route('/orders/<int:order_id>/media', methods=['POST'])
def upload_media(order_id):
    from flask import current_app
    order = Order.query.get_or_404(order_id)

    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400

    files = request.files.getlist('files')
    # Optional parameters (form data)
    item_id = request.form.get('item_id', type=int)  # If provided, attach to specific order item
    side = request.form.get('side')  # 'front', 'back', or None
    is_design = request.form.get('is_design', 'false').lower() in ('true', '1', 'yes')  # Flag for design files

    # Validate item_id if provided - must belong to this order
    if item_id is not None:
        item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first()
        if not item:
            return jsonify({'error': f'Item {item_id} not found for this order'}), 404

    # Validate side if provided
    if side is not None and side not in ('front', 'back'):
        return jsonify({'error': "side must be 'front' or 'back'"}), 400

    current_app.logger.info(f'Upload request for order {order_id}, item_id={item_id}, side={side}, {len(files)} files')
    uploaded = []
    created_media = []  # Track Media objects to get IDs after commit

    if USE_CLOUDINARY:
        current_app.logger.info('Using Cloudinary for upload')
        import cloudinary
        import cloudinary.uploader
        from cloudinary.utils import cloudinary_url

        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )

        for file in files:
            if file and allowed_file(file.filename):
                try:
                    # Build folder path: order_tracker/order_{order_id} or order_tracker/order_{order_id}/item_{item_id}
                    folder = f"order_tracker/order_{order_id}"
                    if item_id is not None:
                        folder = f"{folder}/item_{item_id}"

                    result = cloudinary.uploader.upload(
                        file,
                        folder=folder,
                        resource_type="auto"
                    )

                    file_type = 'Video' if result.get('resource_type') == 'video' else 'Image' if result.get('resource_type') == 'image' else 'File'

                    # Store item_id and side if applicable
                    media = Media(
                        order_id=order.id,
                        item_id=item_id,
                        side=side,
                        file_path=result['public_id'],
                        file_url=result['secure_url'],
                        file_type=file_type,
                        is_design=is_design
                    )
                    db.session.add(media)
                    created_media.append(media)
                    current_app.logger.info(f'Uploaded {file.filename} to Cloudinary: {result["secure_url"]}')
                except Exception as e:
                    current_app.logger.error(f'Cloudinary upload error: {str(e)}')
                    continue
    else:
        current_app.logger.info('Using local filesystem for upload')
        upload_folder = current_app.config['UPLOAD_FOLDER']

        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                # Build path: order_{order_id}/ or order_{order_id}/item_{item_id}/
                subfolder = f"order_{order_id}"
                if item_id is not None:
                    subfolder = os.path.join(subfolder, f"item_{item_id}")
                relative_path = os.path.join(subfolder, filename)
                filepath = os.path.join(upload_folder, relative_path)
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                file.save(filepath)

                ext = filename.rsplit('.', 1)[1].lower()
                if ext in {'mp4', 'mov', 'avi', 'mkv', 'wmv'}:
                    file_type = 'Video'
                elif ext in {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'}:
                    file_type = 'Image'
                else:
                    file_type = 'File'

                file_url = f"/uploads/{relative_path.replace(os.sep, '/')}"

                media = Media(
                    order_id=order.id,
                    item_id=item_id,
                    side=side,
                    file_path=relative_path,
                    file_url=file_url,
                    file_type=file_type,
                    is_design=is_design
                )
                db.session.add(media)
                created_media.append(media)
                current_app.logger.info(f'Saved {filename} locally: {relative_path}, URL: {file_url}')

    db.session.commit()
    current_app.logger.info(f'Upload complete. {len(created_media)} files saved.')

    # Build response array from created Media objects (now have IDs)
    uploaded = []
    for m in created_media:
        uploaded.append({
            'id': m.id,
            'filename': m.file_path.split('/')[-1] if m.file_path else 'unknown',
            'file_type': m.file_type,
            'url': m.file_url,
            'item_id': m.item_id,
            'side': m.side,
            'is_design': m.is_design
        })

    # If these are design files, update order.design_file_url with a JSON array of file info
    if is_design and uploaded:
        import json
        # Load existing array (or initialize empty)
        try:
            existing = json.loads(order.design_file_url) if order.design_file_url else []
        except (json.JSONDecodeError, TypeError):
            existing = []
        # Append new files (with their IDs)
        new_entries = []
        for f in uploaded:
            new_entries.append({
                'url': f['url'],
                'file_type': f['file_type'],
                'filename': f['filename'],
                'media_id': f['id']
            })
        # Combine and save
        combined = existing + new_entries
        order.design_file_url = json.dumps(combined)
        db.session.commit()
        current_app.logger.info(f'Updated order {order_id} design_file_url: now {len(combined)} design files')

    return jsonify({'uploaded': uploaded}), 200

@media_bp.route('/media/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    media = Media.query.get_or_404(media_id)
    order_id = media.order_id

    # Delete from Cloudinary if using it
    if USE_CLOUDINARY and media.file_path and media.file_path.startswith('order_tracker'):
        try:
            import cloudinary.uploader
            cloudinary.uploader.destroy(media.file_path)
        except Exception as e:
            current_app.logger.error(f'Cloudinary delete error: {str(e)}')
    elif media.file_path:
        # Delete from filesystem
        try:
            if os.path.exists(media.file_path):
                os.remove(media.file_path)
        except Exception:
            pass

    # If this is a design file, remove it from order.design_file_url array
    if media.is_design:
        import json
        order = Order.query.get(order_id)  # Get the order
        if order and order.design_file_url:
            try:
                design_array = json.loads(order.design_file_url)
                # Remove entry where media_id matches
                filtered = [entry for entry in design_array if entry.get('media_id') != media_id]
                order.design_file_url = json.dumps(filtered)
                current_app.logger.info(f'Removed media {media_id} from order {order_id} design_file_url array')
            except (json.JSONDecodeError, TypeError):
                current_app.logger.warning(f'Invalid design_file_url JSON for order {order_id}')
                # Reset to empty array if corrupted
                order.design_file_url = json.dumps([])

    db.session.delete(media)
    db.session.commit()

    return jsonify({'message': 'Media deleted'}), 200


@media_bp.route('/media/<int:media_id>/download', methods=['GET'])
def download_media(media_id):
    """Download media file with proper attachment headers"""
    media = Media.query.get_or_404(media_id)

    # For Cloudinary URLs, redirect to the URL
    if media.file_url and (USE_CLOUDINARY or media.file_url.startswith('http')):
        # For Cloudinary, we can request forced download by adding fl=attachment parameter
        # This tells Cloudinary to set Content-Disposition: attachment
        from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
        parsed = urlparse(media.file_url)
        query = parse_qs(parsed.query)
        query['fl'] = ['attachment']  # force download
        new_query = urlencode(query, doseq=True)
        download_url = urlunparse(parsed._replace(query=new_query))
        return redirect(download_url)

    # For local files, serve with attachment header
    if media.file_path:
        # Extract filename from path
        filename = os.path.basename(media.file_path)
        directory = current_app.config['UPLOAD_FOLDER']
        return send_from_directory(
            directory,
            media.file_path,
            as_attachment=True,
            download_name=filename
        )

    return jsonify({'error': 'File not found'}), 404

