import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, List, ListItem, ListItemText, IconButton, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ImageItem } from '../../types/api';

interface ImageUploaderProps {
  images: ImageItem[];
  currentIndex: number;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  onSelectImage: (index: number) => void;
}

const statusColors: Record<ImageItem['status'], 'default' | 'primary' | 'success' | 'error'> = {
  pending: 'default',
  processing: 'primary',
  complete: 'success',
  error: 'error',
};

const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  currentIndex,
  onAddImages,
  onRemoveImage,
  onSelectImage,
}) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onAddImages(acceptedFiles);
    },
    [onAddImages]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    },
    multiple: true,
  });

  return (
    <Box>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.400',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'transparent',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 32, color: 'grey.500', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          {isDragActive ? 'Drop images here...' : 'Drag & drop images, or click to select'}
        </Typography>
      </Box>

      {images.length > 0 && (
        <List dense sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
          {images.map((img, idx) => (
            <ListItem
              key={img.id}
              onClick={() => onSelectImage(idx)}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(idx);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              sx={{
                cursor: 'pointer',
                bgcolor: idx === currentIndex ? 'action.selected' : 'transparent',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ListItemText
                primary={img.file.name}
                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
              />
              <Chip
                label={img.status}
                size="small"
                color={statusColors[img.status]}
                sx={{ ml: 1, mr: 1, fontSize: '0.65rem', height: 20 }}
              />
            </ListItem>
          ))}
        </List>
      )}

      {images.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {images.length} image{images.length !== 1 ? 's' : ''} loaded
        </Typography>
      )}
    </Box>
  );
};

export default ImageUploader;
