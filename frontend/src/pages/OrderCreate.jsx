import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ordersApi, mediaApi } from "../services/api";
import {
  DIVISION_OPTIONS,
  DISTRICT_OPTIONS,
  getDistrictsByDivision,
  getUpazilasByDistrict,
} from "../constants/locations";
import SearchableSelect from "../components/SearchableSelect";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Bars3Icon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { Card, Button, IconButton, EmptyState } from "../components/ui";

const TABS = [
  {
    id: "info",
    label: "Information",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    id: "items",
    label: "Items",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
  {
    id: "attachments",
    label: "Attachments",
    icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
];

const OrderCreate = () => {
  const { id } = useParams(); // If id exists, we're in edit mode
  const isEditMode = !!id;
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(isEditMode);
  const [existingMedia, setExistingMedia] = useState([]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const [formData, setFormData] = useState({
    customer_name: "",
    phone_number: "",
    division_id: "",
    district_id: "",
    upazila_id: "",
    address: "",
    description: "",
    price: "",
    payment_type: "COD",
    courier_parcel_id: "",
    media_files: [],
    items: [],
  });

  const [itemFiles, setItemFiles] = useState({}); // index -> { front: File[], back: File[] }
  const [itemExistingImages, setItemExistingImages] = useState({}); // index -> { front: [], back: [] } (for edit mode)
  const [newItem, setNewItem] = useState({
    size: "M",
    quantity: 1,
    note: "",
    color: "white",
    design: "both",
  });
  const [districtSearch, setDistrictSearch] = useState("");
  const [upazilaSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitAction, setSubmitAction] = useState(null); // 'save' or 'createAnother'
  const [tempIdCounter, setTempIdCounter] = useState(0);

  // Lightbox state for image preview
  const [lightbox, setLightbox] = useState({
    open: false,
    itemIndex: null, // null for order-level attachments
    side: null, // 'front', 'back', or null
    imageIndex: 0,
    existingMediaFile: null, // for order-level attachments
  });

  // Animation state
  const [removingIndex, setRemovingIndex] = useState(null);

  // Track removed existing images: { itemIndex: { front: [], back: [] } }
  const [removedExistingImages, setRemovedExistingImages] = useState({});

  const filteredFormDistricts = useMemo(() => {
    if (!formData.division_id) return [];
    const division = DIVISION_OPTIONS.find(
      (d) => d.id === formData.division_id,
    );
    if (!division) return [];
    return getDistrictsByDivision(division.id);
  }, [formData.division_id]);

  const filteredFormUpazilas = useMemo(() => {
    if (!formData.district_id) return [];
    const district = DISTRICT_OPTIONS.find(
      (d) => d.id === formData.district_id,
    );
    if (!district) return [];
    return getUpazilasByDistrict(district.id);
  }, [formData.district_id]);

  // Fetch order data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      const fetchOrder = async () => {
        try {
          const res = await ordersApi.getById(id, { include_items: true });
          const order = res.data;

          // Map division, district, upazila names to IDs
          const division = DIVISION_OPTIONS.find(
            (div) => div.name === order.division,
          );
          const divisionId = division?.id || "";

          const district = DISTRICT_OPTIONS.find(
            (d) => d.name === order.district,
          );
          const districtId = district?.id || "";

          let upazilaId = "";
          if (districtId) {
            const upazilas = getUpazilasByDistrict(districtId);
            const upazila = upazilas.find((u) => u.name === order.upazila_zone);
            upazilaId = upazila?.id || "";
          }

          // Transform items to match form structure
          const items = (order.items || []).map((item) => ({
            id: item.id,
            size: item.size,
            quantity: item.quantity,
            note: item.note || "",
            color: item.color || "white",
            design: item.design || "both",
            position: item.position,
          }));

          setFormData({
            customer_name: order.customer_name,
            phone_number: order.phone_number,
            division_id: divisionId,
            district_id: districtId,
            upazila_id: upazilaId,
            address: order.address || "",
            description: order.description,
            price: order.price || "",
            payment_type: order.payment_type || "COD",
            courier_parcel_id: order.courier_parcel_id || "",
            media_files: [], // Existing media handled separately
            items: items,
          });

          // Load order-level media
          if (order.media) {
            setExistingMedia(order.media);
          }

          // Load existing item images (front/back) for each item
          const existingItemImages = {};
          order.items?.forEach((item, idx) => {
            existingItemImages[idx] = {
              front: item.front_images || [],
              back: item.back_images || [],
            };
          });
          setItemExistingImages(existingItemImages);

          setLoading(false);
        } catch (error) {
          console.error("Failed to fetch order:", error);
          showNotification("Failed to load order data", "error");
          setLoading(false);
        }
      };

      fetchOrder();
    }
  }, [isEditMode, id]);

  const validateAndAddFiles = (files) => {
    const validFiles = [];
    const maxSize = 16 * 1024 * 1024;
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/svg+xml",
      "video/mp4",
      "video/mov",
      "video/avi",
      "video/mkv",
      "video/wmv",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-7z-compressed",
      "application/x-rar-compressed",
    ];

    for (const file of files) {
      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds 16MB limit. Skipping.`);
        continue;
      }
      if (
        !allowedTypes.includes(file.type) &&
        !file.type.startsWith("image/") &&
        !file.type.startsWith("video/")
      ) {
        alert(`File type not allowed for "${file.name}". Skipping.`);
        continue;
      }
      validFiles.push(file);
    }

    setFormData((prev) => ({
      ...prev,
      media_files: [...prev.media_files, ...validFiles],
    }));
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files) {
      validateAndAddFiles(Array.from(files));
      e.target.value = ""; // reset input
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (const item of items) {
      if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      validateAndAddFiles(files);
    }
  };

  const removeFile = (index) => {
    setFormData((prev) => ({
      ...prev,
      media_files: prev.media_files.filter((_, i) => i !== index),
    }));
  };

  const renderFilePreview = (file, index) => {
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    return (
      <div
        key={index}
        className="bg-dark-900 rounded border border-dark-700 p-2 relative group"
      >
        {isImage ? (
          <img
            src={url}
            alt={file.name}
            className="w-full h-16 object-cover rounded"
            onLoad={(e) => URL.revokeObjectURL(e.target.src)}
          />
        ) : (
          <div className="w-full h-16 bg-dark-700 rounded flex items-center justify-center">
            <svg
              className="w-8 h-8 text-dark-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        <p className="text-xs text-dark-400 truncate mt-1">{file.name}</p>
        <button
          type="button"
          onClick={() => removeFile(index)}
          className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5"
          title="Remove"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  };

  const handleAddItem = (e) => {
    if (e) e.preventDefault();
    if (newItem.size && newItem.quantity > 0) {
      const tempId = `temp-${tempIdCounter}`;
      setTempIdCounter((prev) => prev + 1);
      setFormData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          { ...newItem, position: prev.items.length, temp_id: tempId },
        ],
      }));
      setNewItem({
        size: "M",
        quantity: 1,
        note: "",
        color: "white",
        design: "both",
      });
    }
  };

  const handleRemoveItem = (index) => {
    // Animate removal
    setRemovingIndex(index);
    setTimeout(() => {
      setFormData((prev) => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      }));
      setItemFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[index];
        return newFiles;
      });
      setRemovingIndex(null);
    }, 300);
  };

  // Drag and drop reordering
  const onDragEnd = (result) => {
    if (!result.destination) return;

    const oldItems = [...formData.items];
    const newItems = Array.from(oldItems);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setFormData({
      ...formData,
      items: newItems,
    });

    // Reorder itemFiles to match new items order using stable keys
    setItemFiles((prev) => {
      // Build a map from item key to its files
      const filesByKey = {};
      oldItems.forEach((item, oldIdx) => {
        const key = item.id || item.temp_id;
        if (prev[oldIdx]) {
          filesByKey[key] = prev[oldIdx];
        }
      });

      // Create new itemFiles aligned with newItems order
      const newItemFiles = {};
      newItems.forEach((item, newIdx) => {
        const key = item.id || item.temp_id;
        if (filesByKey[key]) {
          newItemFiles[newIdx] = filesByKey[key];
        }
      });

      return newItemFiles;
    });
  };

  // const handleItemFileChange = (itemIndex, side, files) => {
  //   console.log("handleItemFileChange >> ", itemIndex, side, files)
  //   const validFiles = Array.from(files).slice(0, 2) // limit to 2 per side
  //   setItemFiles(prev => ({
  //     ...prev,
  //     [itemIndex]: {
  //       ...(prev[itemIndex] || {}),
  //       [side]: validFiles
  //     }
  //   }))
  // }
  const handleItemFileChange = (itemIndex, side, files) => {
    const incomingFiles = Array.from(files);

    setItemFiles((prev) => {
      const currentSideFiles = prev[itemIndex]?.[side] || [];

      return {
        ...prev,
        [itemIndex]: {
          ...(prev[itemIndex] || {}),
          [side]: [...currentSideFiles, ...incomingFiles],
        },
      };
    });
  };
  console.log("validFiles >> ", itemFiles);
  // Remove existing image (mark for deletion on save)
  const handleRemoveExistingImage = (itemIndex, side, imageId) => {
    if (!imageId) return;
    setItemExistingImages((prev) => {
      const current = prev[itemIndex]?.[side] || [];
      return {
        ...prev,
        [itemIndex]: {
          ...prev[itemIndex],
          [side]: current.filter((img) => img.id !== imageId),
        },
      };
    });
    setRemovedExistingImages((prev) => {
      const itemRemovals = prev[itemIndex] || { front: [], back: [] };
      return {
        ...prev,
        [itemIndex]: {
          ...itemRemovals,
          [side]: [...(itemRemovals[side] || []), imageId],
        },
      };
    });
  };

  console.log("rmId >> ", removedExistingImages);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    // submitAction is set by the button's onClick

    try {
      // Validation
      if (
        !formData.customer_name ||
        !formData.division_id ||
        !formData.district_id ||
        !formData.upazila_id
      ) {
        showNotification("Please fill all required fields", "error");
        setSaving(false);
        setSubmittingButton(null);
        return;
      }

      // Convert IDs to names
      const division = DIVISION_OPTIONS.find(
        (div) => div.id === formData.division_id,
      );
      const district = DISTRICT_OPTIONS.find(
        (d) => d.id === formData.district_id,
      );
      let upazila_zone = "";
      if (
        typeof formData.upazila_id === "object" &&
        formData.upazila_id !== null
      ) {
        upazila_zone = formData.upazila_id.name || "";
      } else if (formData.upazila_id) {
        const upazila = filteredFormUpazilas.find(
          (u) => u.id === formData.upazila_id,
        );
        upazila_zone = upazila?.name || "";
      }

      const orderData = {
        customer_name: formData.customer_name,
        phone_number: formData.phone_number,
        division: division?.name || "",
        district: district?.name || "",
        upazila_zone,
        address: formData.address,
        description: formData.description,
        price: formData.price,
        payment_type: formData.payment_type,
        courier_parcel_id: formData.courier_parcel_id,
        items: formData.items.map((item) => ({
          size: item.size,
          quantity: item.quantity,
          position: item.position,
          note: item.note,
          color: item.color,
          design: item.design,
        })),
      };

      const mediaFiles = formData.media_files;

      let orderId;
      let savedItems;
      if (isEditMode) {
        // Update existing order
        const res = await ordersApi.update(id, orderData);
        orderId = id;
        savedItems = res.data.items || [];
      } else {
        // Create new order
        const res = await ordersApi.create(orderData);
        orderId = res.data.id;
        savedItems = res.data.items || [];
      }

      // Upload order-level media (for both create and edit)
      if (mediaFiles && mediaFiles.length > 0) {
        try {
          // await mediaApi.uploadDesignFiles(orderId, mediaFiles);
        } catch (err) {
          console.error("Media upload failed:", err);
          showNotification(
            isEditMode
              ? "Order updated but media upload failed."
              : "Order created but media upload failed.",
            "error",
          );
        }
      }
      console.log(
        "Uploading item-specific files...",
        formData.items,
        formData.items.length > 0,
        savedItems,
      );
      // Upload item-specific files (for both create and edit)
      if (formData.items && formData.items.length > 0) {
        for (let idx = 0; idx < formData.items.length; idx++) {
          const savedItem = savedItems[idx];
          // if (!savedItem || !savedItem.id) continue;
          console.log("Uploading item-specific files...", savedItem);
          const filesForItem = itemFiles[idx];
          if (filesForItem) {
            if (filesForItem.front && filesForItem.front.length > 0) {
              try {
                await mediaApi.upload(
                  orderId,
                  filesForItem.front,
                  savedItem.id,
                  "front",
                );
              } catch (uploadErr) {
                console.error("Front image upload failed:", uploadErr);
              }
            }
            if (filesForItem.back && filesForItem.back.length > 0) {
              try {
                await mediaApi.upload(
                  orderId,
                  filesForItem.back,
                  savedItem.id,
                  "back",
                );
              } catch (uploadErr) {
                console.error("Back image upload failed:", uploadErr);
              }
            }
            if (filesForItem.both && filesForItem.both.length > 0) {
              try {
                await mediaApi.upload(
                  orderId,
                  filesForItem.back,
                  savedItem.id,
                  "both",
                );
              } catch (uploadErr) {
                console.error("Back image upload failed:", uploadErr);
              }
            }
          }
        }
      }
      for (let rmId of removedExistingImages[0].front) {
        console.log("Removing existing image...", rmId);
        await mediaApi.delete(rmId);
      }
      for (let rmId of removedExistingImages[0].back) {
        console.log("Removing existing image...", rmId);
        await mediaApi.delete(rmId);
      }

      showNotification(
        isEditMode
          ? "Order updated successfully!"
          : "Order created successfully!",
      );

      // if (submitAction === "createAnother" && !isEditMode) {
      //   // Reset form for another order (only in create mode)
      //   setFormData({
      //     customer_name: "",
      //     phone_number: "",
      //     division_id: "",
      //     district_id: "",
      //     upazila_id: "",
      //     address: "",
      //     description: "",
      //     price: "",
      //     payment_type: "COD",
      //     courier_parcel_id: "",
      //     media_files: [],
      //     items: [],
      //   });
      //   setItemFiles({});
      //   setNewItem({
      //     size: "M",
      //     quantity: 1,
      //     note: "",
      //     color: "white",
      //     design: "both",
      //   });
      //   setDistrictSearch("");
      //   setUpazilaSearch("");
      //   // Scroll to top
      //   window.scrollTo(0, 0);
      // } else {
      //   // Navigate to order view (for edit) or orders list (for create)
      //   if (isEditMode) {
      //     navigate(`/orders/${orderId}`);
      //   } else {
      //     navigate("/orders");
      //   }
      // }
    } catch (error) {
      console.error("Order creation failed:", error);
      showNotification(
        error.response?.data?.error || "Failed to create order",
        "error",
      );
    } finally {
      setSaving(false);
      setSubmitAction(null);
    }
  };

  // UploadZone component with drag-drop and lightbox support
  const UploadZone = ({
    itemIndex,
    side,
    files,
    existingImages = [],
    onFileChange,
    onRemoveFile,
    onRemoveExisting,
    label,
    icon,
    color,
  }) => {
    const dropZoneRef = useRef(null);

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove(
          "border-primary-500",
          "bg-primary-500/10",
        );
      }
      const droppedFiles = Array.from(e.dataTransfer.files);
      const imageFiles = droppedFiles.filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length > 0) {
        onFileChange(imageFiles);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.add(
          "border-primary-500",
          "bg-primary-500/10",
        );
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove(
          "border-primary-500",
          "bg-primary-500/10",
        );
      }
    };

    const handlePaste = (e) => {
      e.preventDefault();
      const clipboardItems = e.clipboardData.items;
      if (!clipboardItems) return;
      const pastedFiles = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        onFileChange(pastedFiles);
      }
    };

    const totalImages = files.length + existingImages.length;

    return (
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-dark-300 mb-3">
          <span
            className="p-1.5 rounded-lg border"
            style={{
              backgroundColor:
                color === "cyan"
                  ? "rgba(6,182,212,0.1)"
                  : color === "pink"
                    ? "rgba(236,72,153,0.1)"
                    : "rgba(59,130,246,0.1)",
              borderColor:
                color === "cyan"
                  ? "rgba(6,182,212,0.3)"
                  : color === "pink"
                    ? "rgba(236,72,153,0.3)"
                    : "rgba(59,130,246,0.3)",
            }}
          >
            {icon}
          </span>
          {label}
          {totalImages > 0 && (
            <span className="ml-1 text-xs font-medium px-2 py-0.5 bg-primary-500/20 text-primary-300 rounded-full border border-primary-500/30">
              {totalImages}
            </span>
          )}
        </label>
        <div
          ref={dropZoneRef}
          className="relative group border-2 border-dashed border-dark-600 rounded-xl p-4 transition-all duration-300 hover:border-primary-500 hover:bg-primary-500/5 cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onPaste={handlePaste}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) =>
              e.target.files && onFileChange(Array.from(e.target.files))
            }
            className="hidden"
            id={`${side}-${itemIndex}-upload`}
          />
          <label
            htmlFor={`${side}-${itemIndex}-upload`}
            className="cursor-pointer block"
          >
            {totalImages > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Existing images */}
                {existingImages.map((img, i) => (
                  <div
                    key={`existing-${img.id}`}
                    className="relative group aspect-square rounded-lg overflow-hidden border-2 border-dark-700 hover:border-primary-500/50 transition-all"
                  >
                    <img
                      src={img.file_url || img.file_path}
                      alt=""
                      className="w-full h-full object-cover"
                      onClick={() =>
                        setLightbox({
                          open: true,
                          itemIndex,
                          side,
                          imageIndex: i,
                          isExisting: true,
                        })
                      }
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<ArrowDownIcon className="w-4 h-4" />}
                        onClick={(e) => {
                          e.preventDefault();
                          const link = document.createElement("a");
                          link.href = img.file_url || img.file_path;
                          link.download = `image-${img.id}`;
                          link.click();
                        }}
                        title="Download"
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<TrashIcon className="w-4 h-4" />}
                        onClick={(e) => {
                          e.preventDefault();
                          onRemoveExisting(img.id);
                        }}
                        title="Remove"
                      />
                    </div>
                  </div>
                ))}
                {/* New files */}
                {files.map((file, i) => (
                  <div
                    key={`new-${i}`}
                    className="relative group aspect-square rounded-lg overflow-hidden border-2 border-dark-700 hover:border-primary-500/50 transition-all"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="w-full h-full object-cover"
                      onClick={() =>
                        setLightbox({
                          open: true,
                          itemIndex,
                          side,
                          imageIndex: i + existingImages.length,
                          isExisting: false,
                        })
                      }
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<ArrowDownIcon className="w-4 h-4" />}
                        onClick={(e) => {
                          e.preventDefault();
                          const link = document.createElement("a");
                          link.href = URL.createObjectURL(file);
                          link.download = file.name;
                          link.click();
                        }}
                        title="Download"
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<TrashIcon className="w-4 h-4" />}
                        onClick={(e) => {
                          e.preventDefault();
                          onRemoveFile(i);
                        }}
                        title="Remove"
                      />
                    </div>
                  </div>
                ))}
                {/* Add more slot */}
                <div className="aspect-square rounded-lg border-2 border-dashed border-dark-500 flex items-center justify-center hover:border-primary-500 hover:bg-primary-500/10 transition-all">
                  <div className="text-center p-2">
                    <PlusIcon className="w-6 h-6 mx-auto mb-1 text-dark-500 group-hover:text-primary-400 transition-colors" />
                    <span className="text-xs text-dark-400">Add</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-dark-800/80 flex items-center justify-center border border-dark-600/50">
                  {icon}
                </div>
                <p className="text-sm font-medium text-dark-300 mb-1">
                  Click or drag files here
                </p>
                <p className="text-xs text-dark-500">
                  PNG, JPG, GIF up to 16MB
                </p>
                <p className="text-xs text-dark-600 mt-2">
                  Tip: Paste (Ctrl+V) images
                </p>
              </div>
            )}
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg border ${notification.type === "error" ? "bg-red-900/30 border-red-700 text-red-300" : "bg-green-900/30 border-green-700 text-green-300"}`}
        >
          {notification.message}
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEditMode ? "Edit Order" : "Create New Order"}
          </h1>
          <p className="text-dark-400 mt-1">
            {isEditMode
              ? "Update order details below"
              : "Enter order details below"}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
        >
          Back to Orders
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-dark-700/50 bg-dark-800/50">
        <nav className="flex gap-1 p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30"
                  : "text-dark-400 hover:text-white hover:bg-dark-700/50"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={tab.icon}
                />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === "info" && (
          <>
            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 shadow-soft p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Customer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Division *
                  </label>
                  <SearchableSelect
                    options={DIVISION_OPTIONS}
                    value={formData.division_id}
                    onChange={(value) => {
                      setFormData({
                        ...formData,
                        division_id: value,
                        district_id: "",
                        upazila_id: "",
                      });
                      setDistrictSearch("");
                      setUpazilaSearch("");
                    }}
                    placeholder="Select Division"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    District *
                  </label>
                  <SearchableSelect
                    options={filteredFormDistricts}
                    value={formData.district_id}
                    onChange={(value) => {
                      setFormData({
                        ...formData,
                        district_id: value,
                        upazila_id: "",
                      });
                      setUpazilaSearch("");
                    }}
                    placeholder="Select District"
                    isDisabled={!formData.division_id}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Thana/Upazila *
                  </label>
                  <SearchableSelect
                    options={filteredFormUpazilas}
                    value={formData.upazila_id}
                    onChange={(value) =>
                      setFormData({ ...formData, upazila_id: value })
                    }
                    placeholder="Select Thana/Upazila"
                    isDisabled={!formData.district_id}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Address
                  </label>
                  <textarea
                    rows="3"
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Full delivery address"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 shadow-soft p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Order Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Payment Type *
                  </label>
                  <select
                    value={formData.payment_type}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_type: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="COD">Cash on Delivery</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Price (৳)
                  </label>
                  <input
                    type="text"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Courier Parcel ID
                  </label>
                  <input
                    type="text"
                    value={formData.courier_parcel_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        courier_parcel_id: e.target.value,
                      })
                    }
                    placeholder="Optional: Assign tracking ID"
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    rows="4"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Product details, sizes, colors, etc."
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "attachments" && (
          <div className="bg-gradient-to-br from-dark-800 to-dark-900 rounded-2xl border border-dark-700/50 shadow-soft p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Attachments
            </h3>
            <div
              className="border-2 border-dashed border-dark-600 rounded-xl p-6 text-center hover:border-primary-500 hover:bg-primary-500/5 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                validateAndAddFiles(files);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add(
                  "border-primary-500",
                  "bg-primary-500/10",
                );
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove(
                  "border-primary-500",
                  "bg-primary-500/10",
                );
              }}
              onPaste={(e) => {
                e.preventDefault();
                const clipboardItems = e.clipboardData.items;
                if (!clipboardItems) return;
                const files = [];
                for (let i = 0; i < clipboardItems.length; i++) {
                  const item = clipboardItems[i];
                  if (
                    item.type.startsWith("image/") ||
                    item.type.startsWith("video/") ||
                    item.type.includes("pdf") ||
                    item.type.includes("document") ||
                    item.type.includes("zip") ||
                    item.type.includes("text")
                  ) {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                  }
                }
                if (files.length > 0) {
                  validateAndAddFiles(files);
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.mov,.avi,.mkv,.wmv,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.7z"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg
                className="w-12 h-12 text-dark-500 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-dark-300 text-sm">
                Click or drag files here to upload
              </p>
              <p className="text-xs text-dark-400 mt-1">
                Images, videos, documents (Max 16MB per file)
              </p>
              <p className="text-xs text-dark-500 mt-1">
                Tip: You can paste files (Ctrl+V) directly here
              </p>
            </div>

            {formData.media_files && formData.media_files.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-dark-300 mb-2">
                  Selected Files ({formData.media_files.length}):
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {formData.media_files.map((file, index) =>
                    renderFilePreview(file, index),
                  )}
                </div>
              </div>
            )}

            {/* Existing order media (edit mode) */}
            {existingMedia && existingMedia.length > 0 && (
              <div className="mt-6">
                <p className="text-sm text-dark-300 mb-2">
                  Existing Attachments ({existingMedia.length}):
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {existingMedia.map((file) => (
                    <div
                      key={file.id}
                      className="relative group rounded-lg overflow-hidden border border-dark-700/50"
                    >
                      {file.file_type === "Image" ||
                      file.file_type === "image" ? (
                        <img
                          src={file.file_url || file.file_path}
                          alt="Attachment"
                          className="w-full h-32 object-cover cursor-pointer"
                          onClick={() =>
                            setLightbox({
                              open: true,
                              itemIndex: null,
                              side: null,
                              imageIndex: 0,
                              isExisting: false,
                              existingMediaFile: file,
                            })
                          }
                        />
                      ) : (
                        <div className="w-full h-32 bg-dark-700 flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-dark-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="p-2 bg-dark-800">
                        <p className="text-xs text-dark-400 truncate">
                          {file.file_path?.split("/").pop() ||
                            file.file_url?.split("/").pop()}
                        </p>
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<ArrowDownIcon className="w-4 h-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement("a");
                            link.href = file.file_url || file.file_path;
                            link.download =
                              file.file_path?.split("/").pop() ||
                              file.file_url?.split("/").pop();
                            link.click();
                          }}
                          title="Download"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "items" && (
          <Card hover gradient className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Order Items</h3>
              <Button
                onClick={handleAddItem}
                icon={<PlusIcon className="w-4 h-4" />}
                size="sm"
              >
                Add Item
              </Button>
            </div>

            {formData.items.length === 0 ? (
              <EmptyState
                icon={<PhotoIcon className="w-16 h-16 text-dark-500" />}
                title="No items yet"
                description="Add items to specify t-shirt sizes and upload design images."
                action={
                  <Button
                    onClick={handleAddItem}
                    icon={<PlusIcon className="w-4 h-4" />}
                    size="sm"
                  >
                    Add First Item
                  </Button>
                }
              />
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="order-items">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {formData.items.map((item, idx) => {
                        const itemKey = item.id || item.temp_id;
                        return (
                          <Draggable
                            key={itemKey}
                            draggableId={itemKey.toString()}
                            index={idx}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`
                                  transition-all duration-300
                                  ${snapshot.isDragging ? "scale-[1.02] shadow-glow rotate-1" : ""}
                                  ${removingIndex === idx ? "opacity-0 scale-95" : "opacity-100"}
                                `}
                                style={provided.draggableProps.style || {}}
                              >
                                <Card
                                  hover
                                  className="p-5 space-y-4"
                                  gradient={idx % 2 === 0}
                                >
                                  {/* Header with drag handle, item info, and remove */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-wrap flex-1">
                                      <div
                                        {...provided.dragHandleProps}
                                        className="p-2 hover:bg-dark-700/50 rounded-lg cursor-grab active:cursor-grabbing transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                        title="Drag to reorder"
                                      >
                                        <Bars3Icon className="w-5 h-5 text-dark-400" />
                                      </div>
                                      <span className="px-3 py-1 bg-gradient-to-r from-primary-500/20 to-accent-cyan/20 text-primary-300 text-xs font-bold rounded-full border border-primary-500/30">
                                        Item #{idx + 1}
                                      </span>

                                      <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                                        <label className="text-sm text-dark-300">
                                          Size:
                                        </label>
                                        <div className="relative">
                                          <select
                                            value={item.size}
                                            onChange={(e) => {
                                              const newItems = [
                                                ...formData.items,
                                              ];
                                              newItems[idx].size =
                                                e.target.value;
                                              setFormData({
                                                ...formData,
                                                items: newItems,
                                              });
                                            }}
                                            className="px-3 py-1.5 bg-dark-800 border-2 border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[100px] appearance-none pr-8"
                                          >
                                            {[
                                              "XS",
                                              "S",
                                              "M",
                                              "L",
                                              "XL",
                                              "XXL",
                                              "XXXL",
                                              "Free Size",
                                            ].map((sz) => (
                                              <option key={sz} value={sz}>
                                                {sz}
                                              </option>
                                            ))}
                                          </select>
                                          <ChevronDownIcon className="w-4 h-4 text-dark-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>

                                        <label className="text-sm text-dark-300 ml-3">
                                          Color:
                                        </label>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newItems = [
                                                ...formData.items,
                                              ];
                                              newItems[idx].color = "white";
                                              setFormData({
                                                ...formData,
                                                items: newItems,
                                              });
                                            }}
                                            className={`px-3 py-1.5 rounded-lg font-medium text-sm border-2 transition-all ${item.color === "white" ? "bg-white border-yellow-500 text-block ring-1 ring-white" : "bg-dark-700/80 border-dark-600 text-dark-300 hover:border-dark-500"}`}
                                          >
                                            White
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newItems = [
                                                ...formData.items,
                                              ];
                                              newItems[idx].color = "black";
                                              setFormData({
                                                ...formData,
                                                items: newItems,
                                              });
                                            }}
                                            className={`px-3 py-1.5 rounded-lg font-medium text-sm border-2 transition-all ${item.color === "black" ? "bg-black border-yellow-500 text-white ring-1 ring-black" : "bg-dark-700/80 border-dark-600 text-dark-300 hover:border-dark-500"}`}
                                          >
                                            Black
                                          </button>
                                        </div>

                                        <label className="text-sm text-dark-300 ml-3">
                                          Design:
                                        </label>
                                        <select
                                          value={item.design || "both"}
                                          onChange={(e) => {
                                            const newItems = [
                                              ...formData.items,
                                            ];
                                            newItems[idx].design =
                                              e.target.value;
                                            setFormData({
                                              ...formData,
                                              items: newItems,
                                            });
                                          }}
                                          className="px-3 py-1.5 bg-dark-800 border-2 border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        >
                                          <option value="front">Front</option>
                                          <option value="back">Back</option>
                                          <option value="both">Both</option>
                                        </select>

                                        <label className="text-sm text-dark-300 ml-3">
                                          Qty:
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          value={item.quantity}
                                          onChange={(e) => {
                                            const newItems = [
                                              ...formData.items,
                                            ];
                                            newItems[idx].quantity =
                                              parseInt(e.target.value) || 1;
                                            setFormData({
                                              ...formData,
                                              items: newItems,
                                            });
                                          }}
                                          className="w-16 px-3 py-1.5 bg-dark-800 border-2 border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        />
                                      </div>
                                    </div>

                                    <IconButton
                                      variant="danger"
                                      size="sm"
                                      icon={<TrashIcon className="w-4 h-4" />}
                                      onClick={() => handleRemoveItem(idx)}
                                      title="Remove item"
                                    />
                                  </div>

                                  {/* Note field */}
                                  <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                                      <PencilIcon className="w-4 h-4" />
                                      Note (optional)
                                    </label>
                                    <textarea
                                      value={item.note || ""}
                                      onChange={(e) => {
                                        const newItems = [...formData.items];
                                        newItems[idx].note = e.target.value;
                                        setFormData({
                                          ...formData,
                                          items: newItems,
                                        });
                                      }}
                                      placeholder="Add a note about this item..."
                                      className="w-full px-4 py-2.5 bg-dark-700/80 border-2 border-dark-600 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                                      rows="2"
                                    />
                                  </div>

                                  {/* Upload Zones */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <UploadZone
                                      itemIndex={idx}
                                      side="front"
                                      files={itemFiles[idx]?.front || []}
                                      existingImages={
                                        itemExistingImages[idx]?.front || []
                                      }
                                      onFileChange={(files) =>
                                        handleItemFileChange(
                                          idx,
                                          "front",
                                          files,
                                        )
                                      }
                                      onRemoveFile={(fileIndex) => {
                                        const newFiles = { ...itemFiles };
                                        if (!newFiles[idx]) newFiles[idx] = {};
                                        newFiles[idx].front = newFiles[
                                          idx
                                        ].front.filter(
                                          (_, i) => i !== fileIndex,
                                        );
                                        setItemFiles(newFiles);
                                      }}
                                      onRemoveExisting={(imgIdx) =>
                                        handleRemoveExistingImage(
                                          idx,
                                          "front",
                                          imgIdx,
                                        )
                                      }
                                      label="Front Design"
                                      icon={
                                        <SunIcon className="w-8 h-8 text-cyan-400" />
                                      }
                                      color="cyan"
                                    />
                                    <UploadZone
                                      itemIndex={idx}
                                      side="back"
                                      files={itemFiles[idx]?.back || []}
                                      existingImages={
                                        itemExistingImages[idx]?.back || []
                                      }
                                      onFileChange={(files) =>
                                        handleItemFileChange(idx, "back", files)
                                      }
                                      onRemoveFile={(fileIndex) => {
                                        const newFiles = { ...itemFiles };
                                        if (!newFiles[idx]) newFiles[idx] = {};
                                        newFiles[idx].back = newFiles[
                                          idx
                                        ].back.filter(
                                          (_, i) => i !== fileIndex,
                                        );
                                        setItemFiles(newFiles);
                                      }}
                                      onRemoveExisting={(imgIdx) =>
                                        handleRemoveExistingImage(
                                          idx,
                                          "back",
                                          imgIdx,
                                        )
                                      }
                                      label="Back Design"
                                      icon={
                                        <MoonIcon className="w-8 h-8 text-pink-400" />
                                      }
                                      color="pink"
                                    />
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors disabled:opacity-50 min-w-[120px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={() => setSubmitAction("save")}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors disabled:opacity-50 min-w-[120px]"
          >
            {saving && submitAction === "save" ? "Saving..." : "Save"}
          </button>
          {!isEditMode && (
            <button
              type="submit"
              onClick={() => setSubmitAction("createAnother")}
              disabled={saving}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors disabled:opacity-50 min-w-[160px]"
            >
              {saving && submitAction === "createAnother"
                ? "Saving..."
                : "Save & Create New"}
            </button>
          )}
        </div>
      </form>

      {/* Image Lightbox Modal */}
      {lightbox.open && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox((prev) => ({ ...prev, open: false }))}
        >
          <button
            className="absolute top-4 right-4 p-2 hover:bg-dark-700 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setLightbox((prev) => ({ ...prev, open: false }))}
          >
            <XMarkIcon className="w-8 h-8 text-white" />
          </button>

          {(() => {
            let allImages = [];
            let currentSrc = "";

            if (lightbox.existingMediaFile) {
              // Order-level attachment
              const file = lightbox.existingMediaFile;
              currentSrc = file.file_url || file.file_path;
              allImages = [file];
            } else if (lightbox.itemIndex !== null && lightbox.side) {
              // Item image (front/back)
              const existing =
                itemExistingImages[lightbox.itemIndex]?.[lightbox.side] || [];
              const newFiles =
                itemFiles[lightbox.itemIndex]?.[lightbox.side] || [];
              allImages = [...existing, ...newFiles];

              if (allImages.length === 0) return null;

              const currentImg = allImages[lightbox.imageIndex];
              const isFile = !currentImg.id;
              currentSrc = isFile
                ? URL.createObjectURL(currentImg)
                : currentImg.file_url || currentImg.file_path;
            } else {
              return null;
            }

            const total = allImages.length;

            return (
              <>
                {/* Navigation buttons */}
                {total > 1 && (
                  <>
                    <button
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-dark-800/80 hover:bg-dark-700 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox((prev) => ({
                          ...prev,
                          imageIndex:
                            prev.imageIndex === 0
                              ? total - 1
                              : prev.imageIndex - 1,
                        }));
                      }}
                    >
                      <ChevronLeftIcon className="w-8 h-8 text-white" />
                    </button>
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-dark-800/80 hover:bg-dark-700 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox((prev) => ({
                          ...prev,
                          imageIndex:
                            prev.imageIndex === total - 1
                              ? 0
                              : prev.imageIndex + 1,
                        }));
                      }}
                    >
                      <ChevronRightIcon className="w-8 h-8 text-white" />
                    </button>
                  </>
                )}

                <div
                  className="max-w-5xl max-h-[90vh] relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={currentSrc}
                    alt="Full size preview"
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  />
                  <p className="text-center text-dark-400 text-sm mt-3">
                    {lightbox.imageIndex + 1} / {total}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default OrderCreate;
