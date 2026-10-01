const fs = require('fs');

let code = fs.readFileSync('src/deliveries/deliveries.service.ts', 'utf8');

code = code.replace(/async updateDeliverySequences\(\s*dto:\s*UpdateDeliverySequenceDto,\s*user:\s*any\s*\)\s*\{/, 'async updatePartnerDeliverySequences(partnerId: string, dto: UpdateDeliverySequenceDto, user: any) {');

code = code.replace(/await this\.prisma\.deliveries\.update\(\{\s*where: \{ id: delivery_id \},\s*data: \{ sequence: new_sequence \},\s*\}\);/,
`await this.prisma.deliveryAssignment.upsert({
                where: { deliveryId: delivery_id },
                update: {
                    deliveryPartnerId: partnerId,
                    sequence: new_sequence,
                },
                create: {
                    deliveryPartnerId: partnerId,
                    deliveryId: delivery_id,
                    sequence: new_sequence,
                },
            });

            await this.prisma.deliveries.update({
                where: { id: delivery_id },
                data: {
                    partnerId: partnerId,
                    sequence: new_sequence,
                },
            });`);

fs.writeFileSync('src/deliveries/deliveries.service.ts', code);
console.log("Updated deliveries.service.ts successfully!");
