#!/bin/bash

# Màu sắc hiển thị
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== HỆ THỐNG ĐẨY CODE VÀ TRIỂN KHAI ZENBOARD LÊN VPS ===${NC}\n"

# 1. Nhập thông tin kết nối (nếu chưa truyền qua env)
if [ -z "$VPS_IP" ]; then
    read -p "1. Nhập địa chỉ IP VPS: " VPS_IP
    while [ -z "$VPS_IP" ]; do
        echo -e "${RED}IP VPS không được để trống!${NC}"
        read -p "Nhập địa chỉ IP VPS: " VPS_IP
    done
fi

if [ -z "$VPS_USER" ]; then
    read -p "2. Nhập SSH User (mặc định: root): " VPS_USER
    VPS_USER=${VPS_USER:-root}
fi

if [ -z "$VPS_PORT" ]; then
    read -p "3. Nhập SSH Port (mặc định: 22): " VPS_PORT
    VPS_PORT=${VPS_PORT:-22}
fi

if [ -z "$SSH_KEY" ]; then
    read -p "4. Nhập đường dẫn file SSH Key (bấm Enter để dùng Mật khẩu hoặc cấu hình SSH mặc định): " SSH_KEY
fi

if [ -z "$TARGET_DIR" ]; then
    read -p "5. Nhập thư mục triển khai trên VPS (mặc định: /var/www/zenboard): " TARGET_DIR
    TARGET_DIR=${TARGET_DIR:-/var/www/zenboard}
fi

# Thiết lập SSH command options dựa trên việc có dùng SSH Key hay không
SSH_OPTS="-p $VPS_PORT"
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

echo -e "\n${YELLOW}* Thông tin triển khai:${NC}"
echo -e " - Host: $VPS_USER@$VPS_IP:$VPS_PORT"
echo -e " - Thư mục VPS: $TARGET_DIR"
if [ -n "$SSH_KEY" ]; then
    echo -e " - SSH Key: $SSH_KEY"
else
    echo -e " - SSH Key: Mật khẩu / SSH config mặc định"
fi

# 2. Tạo file nén mã nguồn
echo -e "\n${BLUE}[1/4] Đang đóng gói mã nguồn thành zenboard.tar.gz...${NC}"
ARCHIVE_NAME="zenboard.tar.gz"

# Dọn dẹp archive cũ nếu có
rm -f $ARCHIVE_NAME

tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='.gemini' \
    --exclude='.DS_Store' \
    --exclude=$ARCHIVE_NAME \
    -czf $ARCHIVE_NAME .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✔ Đóng gói mã nguồn thành công!${NC}"
else
    echo -e "${RED}❌ Đóng gói mã nguồn thất bại!${NC}"
    exit 1
fi

# 3. Tạo thư mục và đẩy file lên VPS
echo -e "\n${BLUE}[2/4] Đang kết nối và đẩy mã nguồn lên VPS...${NC}"

# Chạy SSH để tạo thư mục đích trước
ssh $SSH_OPTS -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "mkdir -p $TARGET_DIR"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Không thể kết nối SSH tới VPS. Vui lòng kiểm tra lại IP/User/Port hoặc Key/Mật khẩu!${NC}"
    rm -f $ARCHIVE_NAME
    exit 1
fi

# SCP đẩy file nén lên VPS
scp $SSH_OPTS $ARCHIVE_NAME $VPS_USER@$VPS_IP:$TARGET_DIR/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✔ Đã tải mã nguồn lên VPS thành công!${NC}"
else
    echo -e "${RED}❌ Đẩy mã nguồn lên VPS thất bại!${NC}"
    rm -f $ARCHIVE_NAME
    exit 1
fi

# Xóa file nén ở local sau khi đẩy xong
rm -f $ARCHIVE_NAME

# 4. Giải nén và kích hoạt ứng dụng trên VPS
echo -e "\n${BLUE}[3/4] Đang giải nén mã nguồn trên VPS...${NC}"

ssh $SSH_OPTS $VPS_USER@$VPS_IP "cd $TARGET_DIR && tar -xzf $ARCHIVE_NAME && rm -f $ARCHIVE_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✔ Giải nén mã nguồn trên VPS thành công!${NC}"
else
    echo -e "${RED}❌ Giải nén mã nguồn trên VPS thất bại!${NC}"
    exit 1
fi

# 5. Chạy Docker Compose
echo -e "\n${BLUE}[4/4] Khởi động ứng dụng bằng Docker Compose trên VPS...${NC}"

ssh $SSH_OPTS $VPS_USER@$VPS_IP "cd $TARGET_DIR && \
    if ! command -v docker &> /dev/null; then \
        echo 'Docker chưa được cài đặt trên VPS. Đang tiến hành cài đặt nhanh...'; \
        curl -fsSL https://get.docker.com | sh; \
    fi && \
    if ! docker compose version &> /dev/null; then \
        echo 'Docker Compose chưa được cài đặt. Đang cấu hình...'; \
        apt-get update && apt-get install -y docker-compose-plugin; \
    fi && \
    echo 'Khởi động các Docker container...' && \
    docker compose down && \
    docker compose up --build -d"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}===================================================${NC}"
    echo -e "${GREEN}🎉 CHÚC MỪNG! ZENBOARD ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG!${NC}"
    echo -e "${GREEN} - Truy cập trang quản trị tại: http://$VPS_IP${NC}"
    echo -e "${GREEN} - Cổng Database PostgreSQL (ngoài): 5433${NC}"
    echo -e "${GREEN}===================================================${NC}"
else
    echo -e "${RED}❌ Khởi chạy Docker Compose trên VPS thất bại! Vui lòng SSH vào VPS để kiểm tra log chi tiết.${NC}"
    exit 1
fi
